import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationSecretsService } from './integration-secrets.service';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [OrganizationsModule, BillingModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationSecretsService],
  exports: [IntegrationsService, IntegrationSecretsService],
})
export class IntegrationsModule {}
