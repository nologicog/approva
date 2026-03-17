import type { Prisma } from '@prisma/client';
import type { PrismaService } from './prisma.service';

export type PrismaDbClient = PrismaService | Prisma.TransactionClient;
