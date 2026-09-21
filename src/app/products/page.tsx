import Link from 'next/link';
import { listProducts, listCategories } from '@/server/queries';
import { ProductsFilters } from '@/components/app/products-filters';
import {
  ListCard,
  ListHeaderBar,
  ListRow,
  NumericCell,
  ProductCell,
  TextCell,
} from '@/components/app/list-pattern';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string; status?: string; filter?: string }>;
}

/**
 * Products — the reference's list pattern: filter row above, one white card
 * with the title + count inside, a black column bar, and gray pill rows
 * (40x40 product images, responsive column hiding per breakpoint) that click
 * through to the product detail page.
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
    <div className="flex flex-col gap-4">
      <ProductsFilters
        categories={categories}
        initialSearch={search}
        initialCategory={category}
        initialStatus={status}
        lowStockOnly={lowStockOnly}
      />

      {rows.length === 0 ? (
        <p className="rounded-[32px] bg-white p-6 text-sm text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          No products match the current filters. Clear the search or choose a different category.
        </p>
      ) : (
        <ListCard
          title="Products"
          count={`${rows.length} ${rows.length === 1 ? 'Product' : 'Products'}`}
          ariaLabel="Product catalog"
        >
          <ListHeaderBar>
            <span className="min-w-0 flex-[3] basis-0">Product</span>
            <span className="hidden min-w-0 flex-[1.5] basis-0 lg:inline-flex">SKU</span>
            <span className="hidden min-w-0 flex-[1.5] basis-0 sm:inline-flex">Category</span>
            <span className="min-w-0 flex-1 basis-0">Stock</span>
            <span className="hidden min-w-0 flex-1 basis-0 md:inline-flex">Reorder Pt.</span>
            <span className="min-w-0 flex-[1.5] basis-0">Status</span>
            <span className="hidden min-w-0 flex-1 basis-0 sm:inline-flex">Velocity</span>
            <span className="hidden min-w-0 flex-1 basis-0 lg:inline-flex">Supplier</span>
          </ListHeaderBar>

          <div className="flex flex-col gap-4 pt-4">
            {rows.map((product) => {
              const low = product.stock <= product.reorderPoint;
              return (
                <ListRow key={product.id} ariaLabel={`Open ${product.name}`}>
                  <Link
                    href={`/products/${product.id}`}
                    className="flex w-full cursor-pointer items-center gap-4"
                    aria-label={`Open ${product.name}`}
                  >
                    <ProductCell name={product.name} imageUrl={product.imageUrl} />
                    <TextCell className="hidden lg:inline-flex">{product.sku}</TextCell>
                    <TextCell className="hidden sm:inline-flex">{product.category}</TextCell>
                    <NumericCell className={low ? 'text-destructive' : ''}>{product.stock}</NumericCell>
                    <NumericCell className="hidden md:inline-flex">{product.reorderPoint}</NumericCell>
                    <span className="min-w-0 flex-[1.5] basis-0">
                      <span className="inline-flex items-center rounded-[40px] bg-white px-2 font-brand text-sm font-normal text-[#111111]">
                        {product.status}
                      </span>
                    </span>
                    <NumericCell className="hidden sm:inline-flex">
                      {product.velocityPerDay.toFixed(1)} / day
                    </NumericCell>
                    <TextCell className="hidden lg:inline-flex">{product.supplierName ?? '—'}</TextCell>
                  </Link>
                </ListRow>
              );
            })}
          </div>
        </ListCard>
      )}
    </div>
  );
}
