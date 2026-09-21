import Link from 'next/link';
import { listSuppliers } from '@/server/queries';

export const dynamic = 'force-dynamic';

/** Suppliers — the reference's 4-column scorecard cards: rating top-right,
 *  name/contact/email in the lower half, product count + terms on the bottom
 *  row. Every card opens the supplier detail page. */
export default async function SuppliersPage() {
  const suppliers = await listSuppliers();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-2.5 pl-2.5">
        <h1 className="font-brand text-sm font-medium text-[#111111]">Suppliers</h1>
        <p className="font-brand text-sm font-normal text-[#898989]">
          {suppliers.length} {suppliers.length === 1 ? 'supplier' : 'suppliers'}
        </p>
      </div>

      {suppliers.length === 0 ? (
        <p className="rounded-[32px] bg-white p-6 font-brand text-sm text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          No suppliers yet.
        </p>
      ) : (
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
          {suppliers.map((supplier) => (
            <Link
              key={supplier.id}
              href={`/suppliers/${supplier.id}`}
              className="flex h-[260px] flex-col rounded-[32px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <div className="flex justify-end">
                <span className="font-brand text-sm font-normal text-[#898989]" aria-label={`Rating ${supplier.rating} of 5`}>
                  {supplier.rating}/5
                </span>
                <span className="ml-1.5 font-brand text-sm text-[#64E03C]" aria-hidden>
                  ★
                </span>
              </div>

              <div className="mt-auto">
                <h2 className="font-brand text-sm font-medium text-[#111111]">{supplier.name}</h2>
                <p className="mt-2 font-brand text-sm font-normal text-[#111111]">{supplier.contactName}</p>
                <p className="font-brand text-sm font-normal text-[#343434]">{supplier.email}</p>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="font-brand text-sm font-normal text-[#898989]">
                  {supplier.productCount} products
                </span>
                <span className="font-brand text-sm font-normal text-[#898989]">{supplier.paymentTerms}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
