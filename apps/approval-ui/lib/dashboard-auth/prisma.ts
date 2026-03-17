import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __authonDashboardPrisma__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__authonDashboardPrisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__authonDashboardPrisma__ = prisma;
}
