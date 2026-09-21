'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Procurement filter bar — search + status, URL-driven like Products. */
export function OrderFilters({ initialSearch, initialStatus }: { initialSearch: string; initialStatus: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    startTransition(() => router.push(`/purchase-orders${params.toString() ? `?${params.toString()}` : ''}`));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pushParams((params) => {
      if (search.trim()) params.set('q', search.trim());
      else params.delete('q');
    });
  }

  function handleStatus(value: string) {
    pushParams((params) => {
      if (value !== 'All Statuses') params.set('status', value);
      else params.delete('status');
    });
  }

  const hasFilters = initialSearch !== '' || initialStatus !== 'All Statuses';

  return (
    <div className="flex flex-wrap items-center gap-2" data-pending={isPending ? 'true' : undefined}>
      <form onSubmit={handleSubmit} className="relative min-w-0 flex-1">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#343434]" aria-hidden />
        {/* name="q": pre-hydration Enter → implicit GET submission carries the
            query (graceful degradation). Inert post-hydration (preventDefault). */}
        <Input
          type="search"
          name="q"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          aria-label="Search purchase orders"
          className="h-[34px] w-full rounded-[40px] border-none bg-secondary pl-10 font-brand text-sm"
        />
      </form>

      <Select value={initialStatus} onValueChange={handleStatus}>
        <SelectTrigger
          aria-label="Filter by status"
          className="h-[34px] w-44 shrink-0 rounded-[40px] border-none bg-secondary font-brand text-sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All Statuses">All Statuses</SelectItem>
          <SelectItem value="Suggested">Suggested</SelectItem>
          <SelectItem value="Approved">Approved</SelectItem>
          <SelectItem value="Delivered">Delivered</SelectItem>
          <SelectItem value="Cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          onClick={() => {
            setSearch('');
            startTransition(() => router.push('/purchase-orders'));
          }}
          className="h-9 rounded-full text-sm text-muted-foreground hover:bg-black/5"
        >
          <X className="h-4 w-4" aria-hidden />
          Clear
        </Button>
      )}
    </div>
  );
}
