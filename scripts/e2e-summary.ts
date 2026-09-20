/**
 * e2e-summary — turn Playwright's JUnit output (test-results/junit.xml) into
 * a compact markdown summary.
 *
 * Why this exists: the exploratory webkit CI job failed on the first hosted
 * run (exit 1), but GitHub's raw step logs AND job-summary markdown render
 * only for signed-in users. Public surfaces are (a) the annotations column
 * of the run page and (b) the report artifact (login). So this script does
 * two things after every E2E job (CI runs it with if: always()):
 *   1. appends a full totals + per-failure markdown table to
 *      $GITHUB_STEP_SUMMARY (visible to signed-in maintainers), and
 *   2. emits `::error` workflow commands (max 10 — GitHub's per-step cap)
 *      that become ANNOTATIONS on the run page — publicly readable without
 *      login, which is how webkit-only failures are diagnosed anonymously.
 *
 * Usage:
 *   bun run e2e:summary                       # after `bun run test:e2e`
 *   E2E_JUNIT_FILE=/tmp/f.xml bun run e2e:summary   # alternate input
 *   E2E_SUMMARY_FILE=/dev/stdout bun run e2e:summary # force stdout mode
 *
 * Behavior:
 *   - No/invalid junit.xml → exit 0 with a note (never fails the job).
 *   - On CI (GITHUB_STEP_SUMMARY set and not stdout mode) → append markdown.
 *   - Locally → print the same markdown to stdout.
 *
 * Parsing note: Playwright's JUnit output is stable and machine-generated
 * (attribute-only elements), so a small regex parser is safe here — no XML
 * dependency needed. If Playwright's format ever changes, this script fails
 * visibly (unknown totals) rather than silently lying.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const JUNIT_PATH = process.env.E2E_JUNIT_FILE ?? "test-results/junit.xml";

interface TestCaseResult {
  project: string;
  name: string;
  file: string;
  line: string;
  time: string;
  status: "passed" | "failed" | "skipped";
  failureMessage: string;
  failureBody: string;
}

function decodeXml(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&");
}

function attr(source: string, name: string): string {
  const match = source.match(new RegExp(`${name}="([^"]*)"`));
  return match ? decodeXml(match[1] ?? "") : "";
}

function parseJunit(xml: string): {
  totals: { tests: number; failures: number; errors: number; skipped: number; time: string };
  cases: TestCaseResult[];
} {
  const root = xml.match(/<testsuites\b[^>]*>/)?.[0] ?? "";
  if (!root) throw new Error("no <testsuites> root found");

  const totals = {
    tests: Number(attr(root, "tests")) || 0,
    failures: Number(attr(root, "failures")) || 0,
    errors: Number(attr(root, "errors")) || 0,
    skipped: Number(attr(root, "skipped")) || 0,
    time: attr(root, "time") || "?",
  };

  const cases: TestCaseResult[] = [];
  // Playwright writes one <testsuite> per spec×project with the project
  // name in the hostname attribute (verified against playwright 1.63).
  const suiteBlocks = xml.match(/<testsuite\b[^>]*>[\s\S]*?<\/testsuite>/g) ?? [];
  for (const suite of suiteBlocks) {
    const suiteTag = suite.match(/<testsuite\b[^>]*>/)?.[0] ?? "";
    const project = attr(suiteTag, "hostname") || "(unknown project)";
    const caseBlocks = suite.match(/<testcase\b[\s\S]*?<\/testcase>/g) ?? [];
    for (const block of caseBlocks) {
      const openTag = block.match(/<testcase\b[^>]*>/)?.[0] ?? "";
      const hasFailure = /<failure[\s>]/.test(block);
      const hasSkipped = /<skipped[\s>]/.test(block);
      const failureElement = block.match(/<failure[^>]*>[\s\S]*?<\/failure>/)?.[0] ?? "";

      cases.push({
        project,
        name: attr(openTag, "name") || "(unnamed test)",
        file: attr(openTag, "file") || attr(suiteTag, "name") || "",
        line: attr(openTag, "line"),
        time: attr(openTag, "time") || "?",
        status: hasFailure ? "failed" : hasSkipped ? "skipped" : "passed",
        failureMessage: attr(failureElement.match(/<failure[^>]*>/)?.[0] ?? "", "message"),
        failureBody: decodeXml(failureElement.replace(/<[^>]+>/g, "").trim()),
      });
    }
  }
  return { totals, cases };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… (truncated — see the playwright-report artifact for the full error)`;
}

/** GitHub workflow-command escaping: %, CR, LF must not appear raw in the
 *  message; property values additionally cannot contain commas or colons. */
function workflowErrorCommand(file: string, line: string, title: string, message: string): string {
  const cleanProp = (s: string) => s.replace(/[%,\r\n:]/g, " ").replace(/\s+/g, " ").trim();
  const cleanTitle = cleanProp(title).slice(0, 100);
  const cleanFile = cleanProp(file).slice(0, 120) || "e2e";
  const cleanLine = /^\d+$/.test(line) ? line : "1";
  const cleanMessage = message.replace(/%/g, "%25").replace(/\r/g, "").replace(/\n/g, " %0A ").slice(0, 350);
  return `::error file=${cleanFile},line=${cleanLine},title=${cleanTitle}::${cleanMessage}`;
}

function buildMarkdown(totals: { tests: number; failures: number; errors: number; skipped: number; time: string }, cases: TestCaseResult[]): string {
  const failed = totals.failures + totals.errors;
  const passed = cases.filter((c) => c.status === "passed").length;
  const verdict = failed > 0 ? "❌ FAILED" : "✅ PASSED";
  const projects = [...new Set(cases.map((c) => c.project))].join(", ") || "(no cases recorded)";
  const lines: string[] = [
    "## Playwright E2E — " + verdict,
    "",
    `- Project(s): **${projects}**`,
    `- **${totals.tests} tests** · ${passed} passed · ${failed} failed · ${totals.skipped} skipped · ${totals.time}s`,
    "",
  ];

  const failures = cases.filter((c) => c.status === "failed");
  if (failures.length > 0) {
    lines.push("| # | Failed test | Location | Time |", "|---|---|---|---|");
    failures.forEach((f, i) => {
      const location = f.line ? `${f.file}:${f.line}` : f.file || "?";
      lines.push(`| ${i + 1} | ${f.name.replace(/\|/g, "\\|")} | ${location.replace(/\|/g, "\\|")} | ${f.time}s |`);
    });
    lines.push("", "<details>", "<summary>Failure details</summary>", "");
    for (const f of failures) {
      const location = f.line ? `${f.file}:${f.line}` : f.file || "?";
      lines.push(`### ${f.name}`, "", `\`${location}\``, "", "```", truncate(f.failureMessage || f.failureBody || "(no failure message recorded)", 1200), "```", "");
    }
    lines.push("</details>");
  }
  return lines.join("\n") + "\n";
}

function inCi(): boolean {
  return process.env.GITHUB_ACTIONS === "true" || Boolean(process.env.GITHUB_STEP_SUMMARY);
}

function emitFailureAnnotations(cases: TestCaseResult[]): void {
  const failures = cases.filter((c) => c.status === "failed");
  // GitHub's hard caps: 10 annotations per step, 50 per run. Keep one slot
  // for the overflow line when there are more failures than slots.
  const max = failures.length > 9 ? 9 : 10;
  for (const f of failures.slice(0, max)) {
    // First ~2-3 lines of the failure: Playwright puts the failed
    // expectation on line 1 and the locator/call-log detail right after.
    const detail = (f.failureMessage || f.failureBody || "(no failure message recorded)")
      .split("\n")
      .slice(0, 4)
      .join("\n")
      .trim();
    console.log(workflowErrorCommand(f.file, f.line, `E2E ${f.project}: ${f.name}`, detail));
  }
  if (failures.length > max) {
    console.log(
      workflowErrorCommand(
        "e2e",
        "1",
        `E2E ${cases[0]?.project ?? ""} — ${failures.length} failed tests total`,
        `Showing the first ${max} as annotations; download the playwright-report artifact for all ${failures.length} failures.`,
      ),
    );
  }
}
function main(): void {
  if (!existsSync(JUNIT_PATH)) {
    console.info(`[e2e-summary] ${JUNIT_PATH} not found — nothing to summarize (did the E2E suite run?).`);
    if (inCi()) {
      console.log(
        workflowErrorCommand(
          "e2e",
          "1",
          "E2E results unavailable",
          "No junit.xml was produced — the suite likely crashed before reporting (browser/webServer launch failure). Download the playwright-report artifact if it exists.",
        ),
      );
    }
    return;
  }
  let parsed: ReturnType<typeof parseJunit>;
  try {
    parsed = parseJunit(readFileSync(JUNIT_PATH, "utf8"));
  } catch (error) {
    console.info(`[e2e-summary] could not parse ${JUNIT_PATH}: ${String(error)}`);
    if (inCi()) {
      console.log(
        workflowErrorCommand("e2e", "1", "E2E results unavailable", `Could not parse junit.xml: ${String(error).slice(0, 200)}`),
      );
    }
    return;
  }
  if (parsed.totals.tests === 0 && parsed.cases.length === 0) {
    console.info(`[e2e-summary] ${JUNIT_PATH} contains no results — nothing to summarize.`);
    if (inCi()) {
      console.log(
        workflowErrorCommand(
          "e2e",
          "1",
          "E2E results unavailable",
          "junit.xml exists but records no test results — the suite crashed before reporting.",
        ),
      );
    }
    return;
  }
  const markdown = buildMarkdown(parsed.totals, parsed.cases);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  const stdoutMode = process.env.E2E_SUMMARY_FILE === "/dev/stdout";
  if (summaryPath && !stdoutMode) {
    appendFileSync(summaryPath, markdown);
    console.info(`[e2e-summary] appended summary to ${summaryPath}`);
  } else {
    console.info(markdown);
  }
  // Public diagnosability: annotations render on the run page without login
  // (job-summary markdown and raw logs do not). Never affects job outcome.
  if (inCi()) emitFailureAnnotations(parsed.cases);
}

main();
