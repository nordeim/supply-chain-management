'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Products filter bar — search + category + status, URL-driven. Submitting
 * the search pushes new query params (server re-renders the filtered table).
 */
export function ProductsFilters({
  categories,
  initialSearch,
  initialCategory,
  initialStatus,
  lowStockOnly,
}: {
  categories: string[];
  initialSearch: string;
  initialCategory: string;
  initialStatus: string;
  lowStockOnly: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    startTransition(() => router.push(`/products${params.toString() ? `?${params.toString()}` : ''}`));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pushParams((params) => {
      if (search.trim()) params.set('q', search.trim());
      else params.delete('q');
    });
  }

  function handleCategory(value: string) {
    pushParams((params) => {
      if (value !== 'All Categories') params.set('category', value);
      else params.delete('category');
    });
  }

  function handleStatus(value: string) {
    pushParams((params) => {
      if (value !== 'All Status') params.set('status', value);
      else params.delete('status');
    });
  }

  function clearAll() {
    setSearch('');
    startTransition(() => router.push('/products'));
  }

  const hasFilters =
    initialSearch !== '' || initialCategory !== 'All Categories' || initialStatus !== 'All Status' || lowStockOnly;

  return (
    <div className="flex flex-wrap items-center gap-2" data-pending={isPending ? 'true' : undefined}>
      <form onSubmit={handleSubmit} className="relative min-w-0 flex-1">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#343434]" aria-hidden />
        {/* name="q": if Enter lands before hydration (no onSubmit wired yet),
            the browser's implicit GET submission carries the query — the URL
            and server-rendered table stay correct. Inert post-hydration:
            handleSubmit preventDefaults, so the URL flow is router-driven. */}
        <Input
          type="search"
          name="q"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          aria-label="Search products"
          className="h-[34px] w-full rounded-[40px] border-none bg-secondary pl-10 font-brand text-sm"
        />
      </form>

      <Select value={initialCategory} onValueChange={handleCategory}>
        <SelectTrigger
          aria-label="Filter by category"
          className="h-[34px] w-44 shrink-0 rounded-[40px] border-none bg-secondary font-brand text-sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All Categories">All Categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={initialStatus} onValueChange={handleStatus}>
        <SelectTrigger
          aria-label="Filter by status"
          className="h-[34px] w-40 shrink-0 rounded-[40px] border-none bg-secondary font-brand text-sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All Status">All Status</SelectItem>
          <SelectItem value="Active">Active</SelectItem>
          <SelectItem value="Discontinued">Discontinued</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          onClick={clearAll}
          className="h-9 rounded-full text-sm text-muted-foreground hover:bg-black/5"
        >
          <X className="h-4 w-4" aria-hidden />
          Clear
        </Button>
      )}
    </div>
  );
}
