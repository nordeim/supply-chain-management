import { NextResponse } from 'next/server';
import { listSuppliersForSelect } from '@/server/queries';

export const dynamic = 'force-dynamic';

/** Supplier options for the New Product dialog (id, name, lead time). */
export async function GET() {
  const suppliers = await listSuppliersForSelect();
  return NextResponse.json({ suppliers });
}
