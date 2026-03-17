import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [LedgerController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
