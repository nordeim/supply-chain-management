'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Link2, LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewProductDialog } from '@/components/app/new-product-dialog';
import { SignInDialog } from '@/components/app/sign-in-dialog';
import { signOutAction } from '@/server/actions';
import type { SessionUser } from '@/lib/session';

/**
 * HeaderBar — brand (logo + app tabs) on the left, actions (New Product,
 * avatar/Sign In, Sign Out) on the right. The "Inventory Manager" tab is the
 * active view pill, matching the reference app's segmented control.
 */
export function HeaderBar({ user }: { user: SessionUser | null }) {
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const initial = (user?.name ?? user?.email ?? '?').trim().charAt(0).toUpperCase();

  function handleSignOut() {
    startTransition(async () => {
      await signOutAction();
      router.refresh();
    });
  }

  return (
    <header className="flex items-center justify-between gap-4 px-4 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/"
          aria-label="Supply Chain Management home"
          className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-black"
        >
          <Link2 className="h-6 w-6 text-white" aria-hidden />
        </Link>
        <div className="flex items-center gap-2" aria-label="Workspace switcher">
          <span className="hidden sm:inline-flex items-center rounded-full bg-[#1f2937] px-4 py-2 text-sm font-medium text-white">
            SupplyChain
          </span>
          <span
            className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            aria-current="page"
          >
            Inventory Manager
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => setNewProductOpen(true)}
          className="rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90 h-10"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New Product
        </Button>
        {user ? (
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#374151] text-sm font-semibold text-white"
              title={user.name ?? user.email}
            >
              {initial}
            </span>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              disabled={isPending}
              className="text-sm text-[#4b5563] hover:bg-black/5 rounded-full"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign Out
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setSignInOpen(true)}
            className="rounded-full border-[#e5e7eb] bg-white text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] h-10"
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
