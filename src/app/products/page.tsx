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
  // The dashboard's Low Stock card links with ?status=low (reference behavior).
  const lowStockOnly = params.filter === 'low' || params.status === 'low';
  const search = params.q?.trim() ?? '';
  const category = params.category ?? 'All Categories';
  const status = params.status && params.status !== 'low' ? params.status : 'All Status';

  const [products, categories] = await Promise.all([
    listProducts(search || undefined, category, status),
    listCategories(),
  ]);

  const rows = lowStockOnly ? products.filter((p) => p.stock <= p.reorderPoint) : products;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ProductsFilters
          categories={categories}
          initialSearch={search}
          initialCategory={category}
          initialStatus={status}
          lowStockOnly={lowStockOnly}
        />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? 'Product' : 'Products'}
            {lowStockOnly && ' at or below reorder point'}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[32px] bg-white p-6 text-sm text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          No products match the current filters. Clear the search or choose a different category.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[32px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-sm font-semibold text-foreground">
                <th scope="col" className="px-5 py-4">Product</th>
                <th scope="col" className="px-5 py-4">SKU</th>
                <th scope="col" className="px-5 py-4">Category</th>
                <th scope="col" className="px-5 py-4 text-right">Stock</th>
                <th scope="col" className="px-5 py-4 text-right">Reorder Pt.</th>
                <th scope="col" className="px-5 py-4">Status</th>
                <th scope="col" className="px-5 py-4 text-right">Velocity</th>
                <th scope="col" className="px-5 py-4">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => {
                const low = product.stock <= product.reorderPoint;
                return (
                  <tr
                    key={product.id}
                    className="border-b border-black/5 transition-colors last:border-0 hover:bg-[#efefef]"
                  >
                    <td className="px-5 py-3.5">
                      <Link href={`/products/${product.id}`} className="font-semibold underline-offset-2 hover:underline">
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{product.sku}</td>
                    <td className="px-5 py-3.5">{product.category}</td>
                    <td className={`px-5 py-3.5 text-right font-semibold ${low ? 'text-destructive' : ''}`}>
                      {product.stock}
                    </td>
                    <td className="px-5 py-3.5 text-right text-muted-foreground">{product.reorderPoint}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant="outline" className="rounded-full border-[#dfdfdf] font-medium text-[#343434]">
                        {product.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">{product.velocityPerDay.toFixed(1)} / day</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{product.supplierName ?? '—'}</td>
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
