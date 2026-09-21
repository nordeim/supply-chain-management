/**
 * Query layer — every read the pages perform, shaped into domain view types.
 *
 * Pages and Server Actions call these functions; nothing in src/app queries
 * Prisma directly (single data-access seam, scandihaven convention).
 * Derived analytics (velocity, KPIs, series) come from the pure domain
 * engine — this layer feeds it ledger rows.
 */

import { db } from '@/lib/db';
import {
  analyzeProduct,
  buildLedgerDaySeries,
  buildStockHistory,
  lowStockScore,
  projectedStockAtLeadTime,
  velocityPerDay,
  VELOCITY_WINDOW_DAYS,
  FORECAST_HORIZON_DAYS,
  type MovementRecord,
} from '@/domain/replenishment';
import { sortMarketTrends, supplierAvgLeadTimeDays } from '@/domain/reference-order';
import type {
  InventoryValuePoint,
  MarketTrendView,
  ProductAnalytics,
  StockFeedItem,
  StockHistoryPoint,
  SupplierView,
} from '@/domain/types';

export interface ProductListItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  reorderPoint: number;
  status: string;
  velocityPerDay: number;
  supplierName: string | null;
  costMinor: number;
  priceMinor: number;
  imageUrl: string | null;
}

function toMovementRecords(
  rows: Array<{ delta: number; reason: string; createdAt: Date }>,
): MovementRecord[] {
  return rows.map((m) => ({ delta: m.delta, reason: m.reason, occurredAt: m.createdAt }));
}

export async function listProducts(search?: string, category?: string, status?: string): Promise<ProductListItem[]> {
  const products = await db.product.findMany({
    where: {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search } },
                { sku: { contains: search } },
              ],
            }
          : {},
        category && category !== 'All Categories' ? { category } : {},
        status && status !== 'All Status' ? { status } : {},
      ],
    },
    include: { supplier: true, movements: true },
    orderBy: { createdAt: 'desc' }, // reference row order (newest first)
  });

  const now = new Date();
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    stock: p.stock,
    reorderPoint: p.reorderPoint,
    status: p.status,
    velocityPerDay: velocityPerDay(toMovementRecords(p.movements), now),
    supplierName: p.supplier?.name ?? null,
    costMinor: p.costMinor,
    priceMinor: p.priceMinor,
    imageUrl: p.imageUrl,
  }));
}

export async function listCategories(): Promise<string[]> {
  const rows = await db.product.findMany({ select: { category: true }, distinct: ['category'] });
  return rows.map((r) => r.category).sort();
}

export interface DashboardData {
  totalSkus: number;
  lowStockScore: number;
  pendingSuggestions: number;
  inventoryValueMinor: number;
  inventoryValueSeries: InventoryValuePoint[];
  topMovers: Array<{
    id: string;
    name: string;
    sku: string;
    velocityPerDay: number;
    totalSales: number;
    salesDelta30d: number;
  }>;
  stockFeed: StockFeedItem[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const products = await db.product.findMany({ include: { supplier: true, movements: true } });
  const suggestedOrders = await db.purchaseOrder.findMany({
    where: { status: 'Suggested' },
    include: { product: { include: { supplier: true } } },
    orderBy: { createdAt: 'desc' }, // reference feed order (newest suggestion first)
  });
  const now = new Date();

  const analyticsByProduct = new Map<string, ProductAnalytics>();
  for (const p of products) {
    analyticsByProduct.set(
      p.id,
      analyzeProduct({
        stock: p.stock,
        reorderPoint: p.reorderPoint,
        reorderQty: p.reorderQty,
        leadTimeDays: p.leadTimeDays,
        supplierLeadTimeDays: p.supplier?.leadTimeDays ?? null,
        movements: toMovementRecords(p.movements),
        now,
      }),
    );
  }

  const totalSkus = products.filter((p) => p.status === 'Active').length;
  const inventoryValueMinor = products.reduce((sum, p) => sum + p.stock * p.costMinor, 0);

  const topMovers = [...products]
    .map((p) => {
      const a = analyticsByProduct.get(p.id)!;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        velocityPerDay: a.velocityPerDay,
        totalSales: a.totalSales,
        salesDelta30d: a.salesDelta30d,
      };
    })
    .filter((p) => p.velocityPerDay > 0)
    .sort((a, b) => b.velocityPerDay - a.velocityPerDay)
    .slice(0, 5);

  // Stock feed (reference semantics): one attention card per product at or
  // below its reorder point (out-of-stock first), followed by one card per
  // pending AI suggestion. Every card navigates to the product detail page.
  const attentionFeed: StockFeedItem[] = products
    .filter((p) => p.stock <= p.reorderPoint)
    .sort((a, b) => {
      if ((a.stock <= 0) !== (b.stock <= 0)) return a.stock <= 0 ? -1 : 1;
      const gapA = a.stock - a.reorderPoint;
      const gapB = b.stock - b.reorderPoint;
      if (gapA !== gapB) return gapA - gapB;
      const va = analyticsByProduct.get(a.id)!.velocityPerDay;
      const vb = analyticsByProduct.get(b.id)!.velocityPerDay;
      return vb - va;
    })
    .map((p) => ({
      kind: 'attention' as const,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      imageUrl: p.imageUrl,
      outOfStock: p.stock <= 0,
      velocityPerDay: analyticsByProduct.get(p.id)!.velocityPerDay,
      reorderPoint: p.reorderPoint,
      supplierName: p.supplier?.name ?? null,
      leadTimeDays: p.leadTimeDays,
      suggestionOrderId: null,
      suggestedQty: null,
      aiReasoning: null,
    }));

  const suggestionFeed: StockFeedItem[] = suggestedOrders.map((o) => ({
    kind: 'suggestion' as const,
    productId: o.productId,
    productName: o.product.name,
    sku: o.product.sku,
    imageUrl: o.product.imageUrl,
    outOfStock: o.product.stock <= 0,
    velocityPerDay: analyticsByProduct.get(o.productId)?.velocityPerDay ?? 0,
    reorderPoint: o.product.reorderPoint,
    supplierName: o.product.supplier?.name ?? null,
    leadTimeDays: o.product.leadTimeDays,
    suggestionOrderId: o.id,
    suggestedQty: o.quantity,
    aiReasoning: o.aiReasoning,
  }));

  const stockFeed = [...attentionFeed, ...suggestionFeed];

  const inventoryValueSeries = buildLedgerDaySeries(
    products.map((p) => ({ costMinor: p.costMinor, movements: toMovementRecords(p.movements) })),
    90,
    now,
  );

  return {
    totalSkus,
    lowStockScore: lowStockScore(products.map((p) => ({ stock: p.stock, reorderPoint: p.reorderPoint }))),
    pendingSuggestions: suggestedOrders.length,
    inventoryValueMinor,
    inventoryValueSeries,
    topMovers,
    stockFeed,
  };
}

export interface ProductDetailData {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string | null;
  status: string;
  imageUrl: string | null;
  costMinor: number;
  priceMinor: number;
  stock: number;
  reorderPoint: number;
  reorderQty: number;
  leadTimeDays: number;
  location: string | null;
  supplierName: string | null;
  analytics: ProductAnalytics;
  stockHistory: StockHistoryPoint[];
  purchaseOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    quantity: number;
    unitCostMinor: number;
    orderDate: Date;
    expectedDelivery: Date | null;
    supplierName: string;
  }>;
}

export async function getProductDetail(id: string): Promise<ProductDetailData | null> {
  const product = await db.product.findUnique({
    where: { id },
    include: { supplier: true, movements: true },
  });
  if (!product) return null;

  const orders = await db.purchaseOrder.findMany({
    where: { productId: id },
    include: { supplier: true },
    orderBy: { orderDate: 'desc' },
    take: 10,
  });

  const now = new Date();
  const movements = toMovementRecords(product.movements);
  const analytics = analyzeProduct({
    stock: product.stock,
    reorderPoint: product.reorderPoint,
    reorderQty: product.reorderQty,
    leadTimeDays: product.leadTimeDays,
    supplierLeadTimeDays: product.supplier?.leadTimeDays ?? null,
    movements,
    now,
  });

  // Stock history over the product's own ledger age (max 1 year).
  const historyDays = Math.min(365, VELOCITY_WINDOW_DAYS + 60);
  const stockHistory = buildStockHistory(movements, historyDays, product.stock, now);

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    description: product.description,
    status: product.status,
    imageUrl: product.imageUrl,
    costMinor: product.costMinor,
    priceMinor: product.priceMinor,
    stock: product.stock,
    reorderPoint: product.reorderPoint,
    reorderQty: product.reorderQty,
    leadTimeDays: product.leadTimeDays,
    location: product.location,
    supplierName: product.supplier?.name ?? null,
    analytics,
    stockHistory,
    purchaseOrders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      quantity: o.quantity,
      unitCostMinor: o.unitCostMinor,
      orderDate: o.orderDate,
      expectedDelivery: o.expectedDelivery,
      supplierName: o.supplier.name,
    })),
  };
}

export interface SuggestionRow {
  orderId: string;
  productId: string;
  productName: string;
  sku: string;
  supplierName: string;
  quantity: number;
  totalCostMinor: number;
  expectedDelivery: Date | null;
  aiReasoning: string | null;
  orderDate: Date;
  imageUrl: string | null;
}

export async function listSuggestions(): Promise<SuggestionRow[]> {
  const orders = await db.purchaseOrder.findMany({
    where: { status: 'Suggested' },
    include: { product: true, supplier: true },
    orderBy: { createdAt: 'desc' }, // reference row order
  });
  return orders.map((o) => ({
    orderId: o.id,
    productId: o.productId,
    productName: o.product.name,
    sku: o.product.sku,
    supplierName: o.supplier.name,
    quantity: o.quantity,
    totalCostMinor: o.unitCostMinor * o.quantity,
    expectedDelivery: o.expectedDelivery,
    aiReasoning: o.aiReasoning,
    orderDate: o.orderDate,
    imageUrl: o.product.imageUrl,
  }));
}

export interface PurchaseOrderRow {
  id: string;
  orderNumber: string;
  productId: string;
  productName: string;
  sku: string;
  productCategory: string;
  supplierName: string;
  quantity: number;
  unitCostMinor: number;
  totalCostMinor: number;
  orderDate: Date;
  status: string;
  expectedDelivery: Date | null;
  imageUrl: string | null;
}

export async function listPurchaseOrders(search?: string, status?: string): Promise<PurchaseOrderRow[]> {
  const orders = await db.purchaseOrder.findMany({
    where: {
      AND: [
        search
          ? {
              OR: [{ orderNumber: { contains: search } }, { product: { name: { contains: search } } }],
            }
          : {},
        status && status !== 'All Statuses' ? { status } : {},
      ],
    },
    include: { product: true, supplier: true },
    orderBy: { orderNumber: 'asc' }, // reference row order (2AF134 first)
  });
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    productId: o.productId,
    productName: o.product.name,
    sku: o.product.sku,
    productCategory: o.product.category,
    supplierName: o.supplier.name,
    quantity: o.quantity,
    unitCostMinor: o.unitCostMinor,
    totalCostMinor: o.unitCostMinor * o.quantity,
    orderDate: o.orderDate,
    status: o.status,
    expectedDelivery: o.expectedDelivery,
    imageUrl: o.product.imageUrl,
  }));
}

export async function listSuppliers(): Promise<SupplierView[]> {
  const suppliers = await db.supplier.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { createdAt: 'desc' }, // reference card order (Nordic first)
  });
  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    contactName: s.contactName,
    email: s.email,
    rating: s.rating,
    paymentTerms: s.paymentTerms,
    leadTimeDays: s.leadTimeDays,
    productCount: s._count.products,
  }));
}

export interface SupplierDetailData {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string | null;
  rating: number;
  paymentTerms: string;
  leadTimeDays: number;
  notes: string | null;
  productCount: number;
  completedOrders: number;
  totalPOs: number;
  avgLeadTimeDays: number | null;
  products: Array<{
    id: string;
    name: string;
    stock: number;
    status: string;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    quantity: number;
    totalCostMinor: number;
    orderDate: Date;
  }>;
}

export async function getSupplierDetail(id: string): Promise<SupplierDetailData | null> {
  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      products: { orderBy: { createdAt: 'desc' } },
      orders: { orderBy: { orderNumber: 'asc' }, take: 10 },
    },
  });
  if (!supplier) return null;

  const totalPOs = await db.purchaseOrder.count({ where: { supplierId: id } });
  const completedOrders = await db.purchaseOrder.count({
    where: { supplierId: id, status: 'Delivered' },
  });

  return {
    id: supplier.id,
    name: supplier.name,
    contactName: supplier.contactName,
    email: supplier.email,
    phone: supplier.phone,
    rating: supplier.rating,
    paymentTerms: supplier.paymentTerms,
    leadTimeDays: supplier.leadTimeDays,
    notes: supplier.notes,
    productCount: supplier.products.length,
    completedOrders,
    totalPOs,
    avgLeadTimeDays: supplierAvgLeadTimeDays(supplier.products),
    products: supplier.products.map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      // Reference health bands (observed live): stock 0 → Out of Stock,
      // stock < 10 → Medium, otherwise Healthy (e.g. Full Frame at 8 → Medium).
      status: p.stock <= 0 ? 'Out of Stock' : p.stock < 10 ? 'Medium' : 'Healthy',
    })),
    recentOrders: supplier.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      quantity: o.quantity,
      totalCostMinor: o.unitCostMinor * o.quantity,
      orderDate: o.orderDate,
    })),
  };
}

export interface MarketTrendsSummary {
  trends: MarketTrendView[];
  avgTrendScore: number;
  risingCount: number;
  decliningCount: number;
  topGainerPct: number;
}

export async function getMarketTrends(): Promise<MarketTrendsSummary> {
  const rows = await db.marketTrend.findMany();
  const trends: MarketTrendView[] = sortMarketTrends(
    rows.map((t) => ({
      id: t.id,
      category: t.category,
      trendScore: t.trendScore,
      changePct: t.changePct,
      direction: t.direction as 'Up' | 'Down' | 'Stable',
      quarter: t.quarter,
      description: t.description,
      source: t.source,
    })),
  );
  const avg = trends.length > 0 ? Math.round(trends.reduce((s, t) => s + t.trendScore, 0) / trends.length) : 0;
  const topGainer = trends.reduce((best, t) => (t.changePct > best.changePct ? t : best), trends[0]!);
  return {
    trends,
    avgTrendScore: avg,
    risingCount: trends.filter((t) => t.direction === 'Up').length,
    decliningCount: trends.filter((t) => t.direction === 'Down').length,
    topGainerPct: trends.length > 0 ? topGainer.changePct : 0,
  };
}

export async function listSuppliersForSelect(): Promise<Array<{ id: string; name: string; leadTimeDays: number }>> {
  return db.supplier.findMany({ select: { id: true, name: true, leadTimeDays: true }, orderBy: { name: 'asc' } });
}

export { projectedStockAtLeadTime, FORECAST_HORIZON_DAYS };
