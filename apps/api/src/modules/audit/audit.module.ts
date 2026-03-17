import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { EventChainService } from './event-chain.service';
import { ImmutableLogModule } from '../immutable-log/immutable-log.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [ImmutableLogModule, LedgerModule],
  providers: [AuditService, EventChainService],
  exports: [AuditService, EventChainService],
})
export class AuditModule {}
