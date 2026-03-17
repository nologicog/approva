import { Global, Module } from '@nestjs/common';
import { RateLimitMiddleware } from './rate-limit.middleware';
import { RateLimitService } from './rate-limit.service';

@Global()
@Module({
  providers: [RateLimitService, RateLimitMiddleware],
  exports: [RateLimitService, RateLimitMiddleware],
})
export class RateLimitModule {}
