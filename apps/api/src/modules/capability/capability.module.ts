import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MachineAuthModule } from '../machine-auth/machine-auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { CapabilityController } from './capability.controller';
import { CapabilityService } from './capability.service';

@Module({
  imports: [AuditModule, OrganizationsModule, MachineAuthModule],
  controllers: [CapabilityController],
  providers: [CapabilityService],
  exports: [CapabilityService],
})
export class CapabilityModule {}
