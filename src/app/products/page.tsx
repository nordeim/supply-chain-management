import Link from 'next/link';
import { Search } from 'lucide-react';
import { listProducts, listCategories } from '@/server/queries';
import { ProductsFilters } from '@/components/app/products-filters';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string; status?: string; filter?: string }>;
}

/**
 * Products — the catalog table with search, category, and status filters
 * (URL-driven so filters are shareable and back-button friendly).
 */
export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lowStockOnly = params.filter === 'low';
  const search = params.q?.trim() ?? '';
  const category = params.category ?? 'All Categories';
  const status = params.status ?? 'All Status';

  const [products, categories] = await Promise.all([
    listProducts(search || undefined, category, status),
    listCategories(),
  ]);

  const rows = lowStockOnly ? products.filter((p) => p.stock <= p.reorderPoint) : products;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? 'product' : 'products'}
            {lowStockOnly && ' at or below reorder point'}
          </p>
        </div>
        <ProductsFilters
          categories={categories}
          initialSearch={search}
          initialCategory={category}
          initialStatus={status}
          lowStockOnly={lowStockOnly}
        />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-[#f3f4f6] p-6 text-sm text-muted-foreground">
          No products match the current filters. Clear the search or choose a different category.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#e5e7eb]">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f9fafb] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-semibold">Product</th>
                <th scope="col" className="px-4 py-3 font-semibold">SKU</th>
                <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Stock</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Reorder Pt.</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Velocity</th>
                <th scope="col" className="px-4 py-3 font-semibold">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => {
                const low = product.stock <= product.reorderPoint;
                return (
                  <tr
                    key={product.id}
                    className="border-b border-[#e5e7eb] last:border-0 transition-colors hover:bg-[#f9fafb]"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/products/${product.id}`} className="font-semibold underline-offset-2 hover:underline">
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{product.sku}</td>
                    <td className="px-4 py-3">{product.category}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${low ? 'text-destructive' : ''}`}>
                      {product.stock}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{product.reorderPoint}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="rounded-full border-[#dcdfe3] font-medium text-[#374151]">
                        {product.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">{product.velocityPerDay.toFixed(1)} / day</td>
                    <td className="px-4 py-3 text-muted-foreground">{product.supplierName ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
