import { PrismaClient } from '@prisma/client'

/**
 * Prisma client singleton.
 *
 * Uses DATABASE_URL (Supabase transaction pooler, port 6543) for all
 * runtime queries — this is the correct connection for a Next.js app.
 * DIRECT_URL (session pooler, port 5432) is only used by Prisma CLI
 * commands (db push, migrate) via prisma.config.ts.
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}
