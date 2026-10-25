import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export { sqliteWriteQueue } from './write-queue';

/**
 * Ensures SQLite runs in Write-Ahead Logging (WAL) mode with high-throughput
 * concurrency settings so all 16 seats can place orders simultaneously without lockouts.
 */
export async function ensureWalMode() {
  if (process.env.DATABASE_URL?.includes('postgres') || process.env.DATABASE_URL?.includes('postgresql')) {
    return; // PostgreSQL natively handles high-concurrency ACID transactions
  }
  try {
    await prisma.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
    await prisma.$queryRawUnsafe(`PRAGMA busy_timeout = 10000;`);
    await prisma.$queryRawUnsafe(`PRAGMA synchronous = NORMAL;`);
  } catch (error) {
    console.error('Failed to configure SQLite WAL mode:', error);
  }
}
