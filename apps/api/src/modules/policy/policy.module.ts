import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PolicyController } from './policy.controller';
import { PolicyService } from './policy.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [PolicyController],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}
