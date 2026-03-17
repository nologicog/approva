import { Injectable } from '@nestjs/common';
import type { PrismaDbClient } from '../../common/prisma/prisma.types';

@Injectable()
export class BillingService {
  async assertApiKeysEnabled(
    organizationId: string,
    prisma?: PrismaDbClient,
  ) {
    void organizationId;
    void prisma;
  }

  async assertIntegrationCreationAllowed(
    organizationId: string,
    prisma?: PrismaDbClient,
  ) {
    void organizationId;
    void prisma;
  }

  async assertApprovalRequestAllowed(
    organizationId: string,
    prisma?: PrismaDbClient,
  ) {
    void organizationId;
    void prisma;
  }
}
