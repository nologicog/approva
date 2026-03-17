import { Global, Module } from '@nestjs/common';
import { RequestContextMiddleware } from '../../common/observability/request-context.middleware';
import { RequestContextService } from '../../common/observability/request-context.service';
import { StructuredLoggerService } from '../../common/observability/structured-logger.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MetricsService } from './metrics.service';
import { ObservabilityController } from './observability.controller';

@Global()
@Module({
  controllers: [ObservabilityController, HealthController],
  providers: [
    RequestContextService,
    RequestContextMiddleware,
    StructuredLoggerService,
    MetricsService,
    HealthService,
  ],
  exports: [
    RequestContextService,
    RequestContextMiddleware,
    StructuredLoggerService,
    MetricsService,
    HealthService,
  ],
})
export class ObservabilityModule {}
