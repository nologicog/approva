import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

@ApiExcludeController()
@Controller('internal')
export class ObservabilityController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  metrics() {
    return this.metricsService.renderPrometheus();
  }
}
