import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  DemoDeploymentExecutionResult,
  DemoTimelineResponse,
} from '@approva/shared';
import { DemoAiDeployService } from './demo-ai-deploy.service';

@ApiTags('demo-ai-deploy')
@Controller('demo/ai-deploy')
export class DemoAiDeployController {
  constructor(private readonly demoAiDeployService: DemoAiDeployService) {}

  @Get(':approvalRequestId/timeline')
  @ApiOperation({ summary: 'Get the Approva AI deploy demo event timeline' })
  @ApiOkResponse({ description: 'Demo timeline retrieved.' })
  getTimeline(
    @Param('approvalRequestId', new ParseUUIDPipe()) approvalRequestId: string,
  ): Promise<DemoTimelineResponse> {
    return this.demoAiDeployService.getTimeline(approvalRequestId);
  }

  @Post(':approvalRequestId/execute')
  @ApiOperation({ summary: 'Record the demo deployment execution after capability use' })
  @ApiOkResponse({ description: 'Demo deployment execution recorded.' })
  execute(
    @Param('approvalRequestId', new ParseUUIDPipe()) approvalRequestId: string,
  ): Promise<DemoDeploymentExecutionResult> {
    return this.demoAiDeployService.executeDeployment(approvalRequestId);
  }
}
