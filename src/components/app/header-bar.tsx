'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewProductDialog } from '@/components/app/new-product-dialog';
import { SignInDialog } from '@/components/app/sign-in-dialog';
import { signOutAction } from '@/server/actions';
import type { SessionUser } from '@/lib/session';

/**
 * HeaderBar — brand (logo + SupplyChain + Inventory Manager) on the left,
 * actions (New Product, avatar/Sign In, Sign Out) on the right, cloned from
 * the reference: 50px tall, transparent, "Inventory Manager" is a small
 * (16px, regular) link that doubles as the dashboard's h1 (a paragraph link
 * on every other route, exactly like the reference).
 */
export function HeaderBar({ user }: { user: SessionUser | null }) {
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname === '/';

  const initial = (user?.name ?? user?.email ?? '?').trim().charAt(0).toUpperCase();

  function handleSignOut() {
    startTransition(async () => {
      await signOutAction();
      router.refresh();
    });
  }

  return (
    <header className="flex h-[50px] items-center justify-between gap-4 px-4">
      <div className="flex items-center gap-4 min-w-0">
        <Link
          href="/"
          aria-label="Supply Chain Management home"
          className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-black"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden fill="none">
            <path
              d="M12 2.5 21 7.25v9.5L12 21.5 3 16.75v-9.5L12 2.5Z"
              stroke="white"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M12 8.2 15.6 10.3v4.2L12 16.6l-3.6-2.1v-4.2L12 8.2Z" fill="white" />
          </svg>
        </Link>
        <div className="flex items-center gap-2" aria-label="Workspace switcher">
          <Link
            href="/"
            className="hidden sm:inline-flex items-center rounded-full bg-[#111111] px-5 py-2 text-sm font-medium text-white"
          >
            SupplyChain
          </Link>
          <Link
            href="/"
            aria-current="page"
            className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
          >
            {isDashboard ? <h1 className="text-base font-normal">Inventory Manager</h1> : 'Inventory Manager'}
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => setNewProductOpen(true)}
          className="h-[50px] rounded-full bg-primary px-6 text-[15px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          New Product
          <Plus className="h-4 w-4" aria-hidden />
        </Button>
        {user ? (
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111111] text-sm font-semibold text-white"
              title={user.name ?? user.email}
            >
              {initial}
            </span>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              disabled={isPending}
              className="h-[50px] rounded-full px-4 text-sm text-[#343434] hover:bg-black/5"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign Out
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setSignInOpen(true)}
            className="h-[50px] rounded-full px-4 text-sm font-medium text-[#343434] hover:bg-black/5"
          >
            Sign In
          </Button>
        )}
      </div>

      <NewProductDialog open={newProductOpen} onOpenChange={setNewProductOpen} />
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </header>
  );
}
