import { HeaderBar } from "@/components/app/header-bar";
import { MobileNav } from "@/components/app/mobile-nav";
import { NavSidebar } from "@/components/app/nav-sidebar";
import type { SessionUser } from "@/lib/session";

/**
 * AppShell — full-width header (brand + actions), then the left nav rail and
 * the content column sitting directly on the gray app background (geometry
 * cloned from the reference: header 50px, nav rail 224px, content at
 * x=256 with sections rendered as white 32px-radius cards).
 *
 * Below `lg` the rail is hidden and the reference's floating bottom pill
 * (MobileNav) provides navigation instead.
 */
export function AppShell({ user, children }: { user: SessionUser | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <HeaderBar user={user} />
      <div className="flex flex-1 gap-0 pb-8 pt-12 min-w-0">
        <NavSidebar />
        <main className="min-w-0 flex-1 px-4 lg:pl-8 lg:pr-4">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
