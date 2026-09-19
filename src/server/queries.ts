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
    orderBy: { name: 'asc' },
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
    velocityDelta: number;
  }>;
  stockFeed: StockFeedItem[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const products = await db.product.findMany({ include: { supplier: true, movements: true } });
  const suggestedOrders = await db.purchaseOrder.findMany({
    where: { status: 'Suggested' },
    include: { product: true },
  });
  const now = new Date();

  // Map of the most recent suggested order per product (for the stock feed).
  const latestSuggestionByProduct = new Map<
    string,
    { id: string; quantity: number; reasoning: string | null; createdAt: Date }
  >();
  for (const order of suggestedOrders) {
    const existing = latestSuggestionByProduct.get(order.productId);
    if (!existing || order.createdAt >= existing.createdAt) {
      latestSuggestionByProduct.set(order.productId, {
        id: order.id,
        quantity: order.quantity,
        reasoning: order.aiReasoning,
        createdAt: order.createdAt,
      });
    }
  }

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
        velocityDelta: a.velocityDelta,
      };
    })
    .filter((p) => p.velocityPerDay > 0)
    .sort((a, b) => b.velocityPerDay - a.velocityPerDay)
    .slice(0, 5);

  const stockFeed: StockFeedItem[] = products
    .map((p) => {
      const a = analyticsByProduct.get(p.id)!;
      const suggestion = latestSuggestionByProduct.get(p.id) ?? null;
      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        stock: p.stock,
        reorderPoint: p.reorderPoint,
        velocityPerDay: a.velocityPerDay,
        outOfStock: p.stock <= 0,
        supplierName: p.supplier?.name ?? null,
        supplierLeadTimeDays: p.supplier?.leadTimeDays ?? null,
        suggestionOrderId: suggestion?.id ?? null,
        suggestedQty: suggestion?.quantity ?? null,
        aiReasoning: suggestion?.reasoning ?? null,
      };
    })
    .filter((item) => item.stock <= item.reorderPoint || item.suggestionOrderId !== null)
    .sort((a, b) => {
      // Priority: out of stock first, then deepest stock gap, then velocity.
      if (a.outOfStock !== b.outOfStock) return a.outOfStock ? -1 : 1;
      const gapA = a.stock - a.reorderPoint;
      const gapB = b.stock - b.reorderPoint;
      if (gapA !== gapB) return gapA - gapB;
      return b.velocityPerDay - a.velocityPerDay;
    });

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
  costMinor: number;
  priceMinor: number;
  stock: number;
  reorderPoint: number;
  reorderQty: number;
  leadTimeDays: number;
  location: string | null;
  supplierName: string | null;
  supplierLeadTimeDays: number | null;
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
    costMinor: product.costMinor,
    priceMinor: product.priceMinor,
    stock: product.stock,
    reorderPoint: product.reorderPoint,
    reorderQty: product.reorderQty,
    leadTimeDays: product.leadTimeDays,
    location: product.location,
    supplierName: product.supplier?.name ?? null,
    supplierLeadTimeDays: product.supplier?.leadTimeDays ?? null,
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
}

export async function listSuggestions(): Promise<SuggestionRow[]> {
  const orders = await db.purchaseOrder.findMany({
    where: { status: 'Suggested' },
    include: { product: true, supplier: true },
    orderBy: { orderDate: 'desc' },
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
  }));
}

export interface PurchaseOrderRow {
  id: string;
  orderNumber: string;
  productId: string;
  productName: string;
  sku: string;
  supplierName: string;
  quantity: number;
  totalCostMinor: number;
  orderDate: Date;
  status: string;
  expectedDelivery: Date | null;
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
    orderBy: [{ orderDate: 'desc' }, { orderNumber: 'asc' }],
  });
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    productId: o.productId,
    productName: o.product.name,
    sku: o.product.sku,
    supplierName: o.supplier.name,
    quantity: o.quantity,
    totalCostMinor: o.unitCostMinor * o.quantity,
    orderDate: o.orderDate,
    status: o.status,
    expectedDelivery: o.expectedDelivery,
  }));
}

export async function listSuppliers(): Promise<SupplierView[]> {
  const suppliers = await db.supplier.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
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

export interface MarketTrendsSummary {
  trends: MarketTrendView[];
  avgTrendScore: number;
  risingCount: number;
  decliningCount: number;
  topGainerPct: number;
}

export async function getMarketTrends(): Promise<MarketTrendsSummary> {
  const rows = await db.marketTrend.findMany({ orderBy: { changePct: 'desc' } });
  const trends: MarketTrendView[] = rows.map((t) => ({
    id: t.id,
    category: t.category,
    trendScore: t.trendScore,
    changePct: t.changePct,
    direction: t.direction as 'Up' | 'Down' | 'Stable',
    quarter: t.quarter,
    description: t.description,
    source: t.source,
  }));
  const avg = trends.length > 0 ? Math.round(trends.reduce((s, t) => s + t.trendScore, 0) / trends.length) : 0;
  return {
    trends,
    avgTrendScore: avg,
    risingCount: trends.filter((t) => t.direction === 'Up').length,
    decliningCount: trends.filter((t) => t.direction === 'Down').length,
    topGainerPct: trends.length > 0 ? trends[0]!.changePct : 0,
  };
}

export async function listSuppliersForSelect(): Promise<Array<{ id: string; name: string; leadTimeDays: number }>> {
  return db.supplier.findMany({ select: { id: true, name: true, leadTimeDays: true }, orderBy: { name: 'asc' } });
}

export { projectedStockAtLeadTime, FORECAST_HORIZON_DAYS };
