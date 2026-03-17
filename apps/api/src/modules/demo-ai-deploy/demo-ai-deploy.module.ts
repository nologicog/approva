import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DemoAiDeployController } from './demo-ai-deploy.controller';
import { DemoAiDeployService } from './demo-ai-deploy.service';

@Module({
  imports: [AuditModule, OrganizationsModule],
  controllers: [DemoAiDeployController],
  providers: [DemoAiDeployService],
})
export class DemoAiDeployModule {}
