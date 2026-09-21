import { PrismaClient } from '@prisma/client'

import { resolveDatabaseUrl } from './db-path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Query-level logging is disabled: it flooded the dev log on every render.
// Errors and warnings still surface through Prisma's default logging.
// The datasource URL is anchored at the repo root via db-path so a
// relative `file:../db/custom.db` opens <repo>/db/custom.db regardless of
// the process working directory (see src/lib/db-path.ts).
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    datasourceUrl: resolveDatabaseUrl(process.env.DATABASE_URL),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db