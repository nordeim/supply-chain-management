'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { NewProductDialog } from '@/components/app/new-product-dialog';
import { SignInDialog } from '@/components/app/sign-in-dialog';
import {
  PlusGlyph,
  SignInGlyph,
  SignOutGlyph,
  UserGlyph,
} from '@/components/app/nav-items';
import { signOutAction } from '@/server/actions';
import type { SessionUser } from '@/lib/session';

/**
 * HeaderBar — reference geometry (computed-style audit, Session 9):
 * a 50px-tall bar with 16px horizontal padding; left = logo (50px black
 * circle) + "SupplyChain" black pill + "Inventory Manager" orange pill
 * (both 32px-radius, 16px-padding, 14px/400 labels — the orange label
 * wraps to two lines on narrow screens); right = "New Product" (orange
 * 32px-radius pill, hidden below md) and the auth button, which
 * collapses to a 50px #DFDFDF circle with a 34px black core below md
 * (avatar initial when signed in, user glyph when signed out) and grows
 * to a rounded pill at md+.
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
      <div className="flex min-w-0 items-center gap-1" aria-label="Workspace switcher">
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
        <Link
          href="/"
          className="flex h-[50px] items-center rounded-[32px] bg-[#111111] px-4 font-brand"
        >
          <p className="text-sm font-normal leading-[18px] text-white">
            <span className="font-semibold">Supply</span>Chain
          </p>
        </Link>
        <Link
          href="/"
          aria-current="page"
          className="flex h-[50px] items-center rounded-[32px] bg-primary px-4 text-center"
        >
          {isDashboard ? (
            <h1 className="text-base font-normal font-brand leading-[20px] text-[#0F1729]">Inventory Manager</h1>
          ) : (
            <p className="text-sm font-normal font-brand leading-[18px] text-[#0F1729]">Inventory Manager</p>
          )}
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Button
          onClick={() => setNewProductOpen(true)}
          className="hidden h-[50px] rounded-[32px] bg-primary px-4 text-sm font-normal font-brand text-[#111111] hover:bg-primary/90 md:inline-flex md:gap-1"
        >
          New Product
          <PlusGlyph className="-ml-1 h-2 w-2 shrink-0" aria-hidden />
        </Button>
        {user ? (
          <Button
            variant="ghost"
            onClick={handleSignOut}
            disabled={isPending}
            aria-label="Sign Out"
            className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-secondary p-0 hover:bg-secondary/80 md:h-[50px] md:w-auto md:rounded-[100px] md:pl-2 md:pr-4"
          >
            <span
              aria-hidden
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#111111] text-sm font-normal font-brand text-white"
              title={user.name ?? user.email}
            >
              {initial}
            </span>
            <span className="ml-2 hidden items-center gap-2 md:flex">
              <SignOutGlyph className="h-[13px] w-[13px] shrink-0" aria-hidden />
              <span className="text-sm font-normal font-brand leading-none text-[#111111]">Sign Out</span>
            </span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setSignInOpen(true)}
            aria-label="Sign In"
            className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-secondary p-0 hover:bg-secondary/80 md:h-[50px] md:w-auto md:rounded-[100px] md:pl-2 md:pr-4"
          >
            <span aria-hidden className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#111111]">
              <UserGlyph className="h-3.5 w-3 shrink-0 text-white" aria-hidden />
            </span>
            <span className="ml-2 hidden items-center gap-2 md:flex">
              <SignInGlyph className="h-[13px] w-[13px] shrink-0" aria-hidden />
              <span className="text-sm font-normal font-brand leading-none text-[#111111]">Sign In</span>
            </span>
          </Button>
        )}
      </div>

      <NewProductDialog open={newProductOpen} onOpenChange={setNewProductOpen} />
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </header>
  );
}
