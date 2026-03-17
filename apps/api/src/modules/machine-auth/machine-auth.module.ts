import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ApiKeysController } from './api-keys.controller';
import { MachineAuthService } from './machine-auth.service';
import { ServiceAccountsController } from './service-accounts.controller';

@Module({
  imports: [OrganizationsModule, BillingModule],
  controllers: [ServiceAccountsController, ApiKeysController],
  providers: [MachineAuthService],
  exports: [MachineAuthService],
})
export class MachineAuthModule {}
