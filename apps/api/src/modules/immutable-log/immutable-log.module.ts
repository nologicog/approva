import { Module } from '@nestjs/common';
import { ImmutableLogService } from './immutable-log.service';

@Module({
  providers: [ImmutableLogService],
  exports: [ImmutableLogService],
})
export class ImmutableLogModule {}
