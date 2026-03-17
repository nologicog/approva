import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { OrganizationRbacService } from './organization-rbac.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [EmailModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationRbacService],
  exports: [OrganizationsService, OrganizationRbacService],
})
export class OrganizationsModule {}
