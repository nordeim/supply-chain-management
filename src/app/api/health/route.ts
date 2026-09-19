import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Liveness/readiness probe — verifies the app boots and the DB answers. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[health] database check failed', error);
    return NextResponse.json({ status: 'degraded', database: 'down' }, { status: 503 });
  }
}
