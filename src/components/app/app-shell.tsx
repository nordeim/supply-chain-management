import { HeaderBar } from "@/components/app/header-bar";
import { NavSidebar } from "@/components/app/nav-sidebar";
import type { SessionUser } from "@/lib/session";

/**
 * AppShell — full-width header (brand tabs + actions), then a left nav rail
 * and the white rounded content container. Layout geometry cloned from the
 * reference app (header 50px, nav rail 224px, content radius 32px).
 */
export function AppShell({ user, children }: { user: SessionUser | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col">
      <HeaderBar user={user} />
      <div className="flex flex-1 gap-4 px-4 pb-6 min-w-0">
        <NavSidebar />
        <main className="flex-1 min-w-0 bg-white rounded-[32px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
