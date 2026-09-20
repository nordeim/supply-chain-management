import { HeaderBar } from "@/components/app/header-bar";
import { NavSidebar } from "@/components/app/nav-sidebar";
import type { SessionUser } from "@/lib/session";

/**
 * AppShell — full-width header (brand + actions), then the left nav rail and
 * the content column sitting directly on the gray app background (geometry
 * cloned from the reference: header 50px, nav rail 224px, content at
 * x=256 with sections rendered as white 32px-radius cards).
 */
export function AppShell({ user, children }: { user: SessionUser | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <HeaderBar user={user} />
      <div className="flex flex-1 gap-0 px-4 pb-8 pt-12 min-w-0">
        <NavSidebar />
        <main className="min-w-0 flex-1 lg:pl-2">{children}</main>
      </div>
    </div>
  );
}
