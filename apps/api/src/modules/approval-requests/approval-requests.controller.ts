import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { ApprovalRequestResponse, ExpirationSweepResult } from '@approva/shared';
import type { Request } from 'express';
import { RequestContextService } from '../../common/observability/request-context.service';
import { AuthService } from '../auth/auth.service';
import { ApprovalRequestsService } from './approval-requests.service';
import { ApprovalAccessTokenQueryDto } from './dto/approval-access-token-query.dto';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { CreateApprovalRequestDto } from './dto/create-approval-request.dto';
import { ExpireSweepDto } from './dto/expire-sweep.dto';
import { MachineAuthService } from '../machine-auth/machine-auth.service';
import { RejectRequestDto } from './dto/reject-request.dto';
import { SecureDecisionDto } from './dto/secure-decision.dto';

@ApiTags('approval-requests')
@Controller('approval-requests')
export class ApprovalRequestsController {
  constructor(
    private readonly approvalRequestsService: ApprovalRequestsService,
    private readonly authService: AuthService,
    private readonly machineAuthService: MachineAuthService,
    private readonly requestContextService: RequestContextService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an approval request' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Optional idempotency key. Replays with the same key and same payload return the original request.',
  })
  @ApiHeader({
    name: 'Authorization',
    required: false,
    description: 'Optional machine auth bearer token in the format Bearer authon_sk_....',
  })
  @ApiCreatedResponse({ description: 'Approval request created.' })
  async create(
    @Body() input: CreateApprovalRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-authon-organization-id') organizationId?: string,
    @Headers('x-authon-organization-slug') organizationSlug?: string,
  ): Promise<ApprovalRequestResponse> {
    const machinePrincipal = await this.machineAuthService.authenticateFromAuthorizationHeader(
      authorization,
      'approval_requests:create',
    );

    return this.approvalRequestsService.createRequest(
      input,
      idempotencyKey,
      machinePrincipal
        ? {
            organizationId: machinePrincipal.organizationId,
          }
        : {
            organizationId,
            organizationSlug,
          },
      machinePrincipal,
    );
  }

  @Post('internal/expire-sweep')
  @ApiOperation({ summary: 'Expire pending approval requests whose expiry has passed' })
  @ApiOkResponse({ description: 'Expiration sweep completed.' })
  expireSweep(
    @Query() query: ExpireSweepDto,
    @Headers('x-authon-organization-id') organizationId?: string,
    @Headers('x-authon-organization-slug') organizationSlug?: string,
  ): Promise<ExpirationSweepResult> {
    return this.approvalRequestsService.expirePendingRequests(query.limit, {
      organizationId,
      organizationSlug,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get approval request details for system/integrator usage' })
  @ApiHeader({
    name: 'Authorization',
    required: false,
    description: 'Optional machine auth bearer token in the format Bearer authon_sk_....',
  })
  @ApiOkResponse({ description: 'Approval request details.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-authon-organization-id') organizationId?: string,
    @Headers('x-authon-organization-slug') organizationSlug?: string,
  ): Promise<ApprovalRequestResponse> {
    this.requestContextService.setApprovalRequestId(id);
    const machinePrincipal = await this.machineAuthService.authenticateFromAuthorizationHeader(
      authorization,
      'approval_requests:read',
    );

    return this.approvalRequestsService.getRequestById(
      id,
      machinePrincipal
        ? {
            organizationId: machinePrincipal.organizationId,
          }
        : {
            organizationId,
            organizationSlug,
          },
    );
  }

  @Get(':id/secure-view')
  @ApiOperation({ summary: 'Get approval request details using an approval access token' })
  @ApiQuery({ name: 'token', required: true })
  @ApiOkResponse({ description: 'Secure approval request view.' })
  async getSecureView(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ApprovalAccessTokenQueryDto,
    @Req() request: Request,
    @Headers('x-authon-organization-id') organizationId?: string,
    @Headers('x-authon-organization-slug') organizationSlug?: string,
  ): Promise<ApprovalRequestResponse> {
    this.requestContextService.setApprovalRequestId(id);
    const session = await this.authService.getSessionState(request);

    if (session.user?.id) {
      this.requestContextService.setUserId(session.user.id);
    }

    return this.approvalRequestsService.getSecureRequestById(
      id,
      query.token,
      {
        organizationId,
        organizationSlug,
      },
      session,
    );
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a pending request' })
  @ApiOkResponse({ description: 'Approval request approved.' })
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ApproveRequestDto,
    @Headers('x-authon-organization-id') organizationId?: string,
    @Headers('x-authon-organization-slug') organizationSlug?: string,
  ): Promise<ApprovalRequestResponse> {
    this.requestContextService.setApprovalRequestId(id);
    return this.approvalRequestsService.approveRequest(id, input, {
      organizationId,
      organizationSlug,
    });
  }

  @Post(':id/secure-approve')
  @ApiOperation({ summary: 'Approve a pending request using an approval access token' })
  @ApiQuery({ name: 'token', required: true })
  @ApiOkResponse({ description: 'Approval request approved.' })
  async secureApprove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ApprovalAccessTokenQueryDto,
    @Body() input: SecureDecisionDto,
    @Req() request: Request,
    @Headers('x-authon-organization-id') organizationId?: string,
    @Headers('x-authon-organization-slug') organizationSlug?: string,
  ): Promise<ApprovalRequestResponse> {
    this.requestContextService.setApprovalRequestId(id);
    const session = await this.authService.requireAuthenticatedSession(request);
    this.requestContextService.setUserId(session.approverUser.id);

    return this.approvalRequestsService.approveRequestWithToken(
      id,
      query.token,
      input,
      session,
      {
        organizationId,
        organizationSlug,
      },
    );
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a pending request' })
  @ApiOkResponse({ description: 'Approval request rejected.' })
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: RejectRequestDto,
    @Headers('x-authon-organization-id') organizationId?: string,
    @Headers('x-authon-organization-slug') organizationSlug?: string,
  ): Promise<ApprovalRequestResponse> {
    this.requestContextService.setApprovalRequestId(id);
    return this.approvalRequestsService.rejectRequest(id, input, {
      organizationId,
      organizationSlug,
    });
  }

  @Post(':id/secure-reject')
  @ApiOperation({ summary: 'Reject a pending request using an approval access token' })
  @ApiQuery({ name: 'token', required: true })
  @ApiOkResponse({ description: 'Approval request rejected.' })
  async secureReject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ApprovalAccessTokenQueryDto,
    @Body() input: SecureDecisionDto,
    @Req() request: Request,
    @Headers('x-authon-organization-id') organizationId?: string,
    @Headers('x-authon-organization-slug') organizationSlug?: string,
  ): Promise<ApprovalRequestResponse> {
    this.requestContextService.setApprovalRequestId(id);
    const session = await this.authService.requireAuthenticatedSession(request);
    this.requestContextService.setUserId(session.approverUser.id);

    return this.approvalRequestsService.rejectRequestWithToken(
      id,
      query.token,
      input,
      session,
      {
        organizationId,
        organizationSlug,
      },
    );
  }
}
