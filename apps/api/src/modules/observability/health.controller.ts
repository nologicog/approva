import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(200)
  live() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response) {
    const readiness = await this.healthService.getReadiness();

    response.status(readiness.ok ? 200 : 503);
    return readiness.body;
  }
}
