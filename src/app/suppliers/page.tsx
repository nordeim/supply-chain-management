import { Star } from 'lucide-react';
import Link from 'next/link';
import { listSuppliers } from '@/server/queries';

export const dynamic = 'force-dynamic';

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Rating ${rating} of 5`}>
      <span className="text-sm font-bold">{rating}/5</span>
      <Star className="h-4 w-4 fill-primary text-primary" aria-hidden />
    </span>
  );
}

/** Suppliers — partner scorecard cards; each card opens the supplier detail. */
export default async function SuppliersPage() {
  const suppliers = await listSuppliers();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {suppliers.length} {suppliers.length === 1 ? 'supplier' : 'suppliers'}
        </p>
      </div>

      {suppliers.length === 0 ? (
        <p className="rounded-[32px] bg-white p-6 text-sm text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          No suppliers yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {suppliers.map((supplier) => (
            <Link
              key={supplier.id}
              href={`/suppliers/${supplier.id}`}
              className="block rounded-[32px] bg-white p-6 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StarRating rating={supplier.rating} />
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-[#343434]">
                  {supplier.paymentTerms}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-bold">{supplier.name}</h2>
              <div className="mt-3 space-y-1.5 text-sm">
                <p className="text-[#343434]">
                  <span className="text-muted-foreground">Contact: </span>
                  {supplier.contactName}
                </p>
                <span className="block truncate font-medium text-[#343434] underline-offset-2">
                  {supplier.email}
                </span>
                <p className="text-muted-foreground">
                  {supplier.productCount} {supplier.productCount === 1 ? 'product' : 'products'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
