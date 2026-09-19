import { Star } from 'lucide-react';
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

/** Suppliers — partner cards with rating, contact, terms, and lead time. */
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
        <p className="rounded-2xl bg-[#f3f4f6] p-6 text-sm text-muted-foreground">No suppliers yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {suppliers.map((supplier) => (
            <article key={supplier.id} className="rounded-2xl bg-[#f3f4f6] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StarRating rating={supplier.rating} />
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#374151]">
                  {supplier.paymentTerms}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-bold">{supplier.name}</h2>
              <div className="mt-3 space-y-1.5 text-sm">
                <p className="text-[#374151]">
                  <span className="text-muted-foreground">Contact: </span>
                  {supplier.contactName}
                </p>
                <a
                  href={`mailto:${supplier.email}`}
                  className="block truncate font-medium text-[#374151] underline-offset-2 hover:underline"
                >
                  {supplier.email}
                </a>
                <p className="text-muted-foreground">
                  {supplier.productCount} {supplier.productCount === 1 ? 'product' : 'products'} · {supplier.leadTimeDays}-day lead time
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
