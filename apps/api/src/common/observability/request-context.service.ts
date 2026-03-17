import { Injectable } from '@nestjs/common';
import type { RequestContextState } from './request-context';
import {
  getRequestContext,
  runWithRequestContext,
  updateRequestContext,
} from './request-context';

@Injectable()
export class RequestContextService {
  run<T>(initialState: RequestContextState, callback: () => T) {
    return runWithRequestContext(initialState, callback);
  }

  get() {
    return getRequestContext();
  }

  setOrganizationId(organizationId?: string | null) {
    updateRequestContext({
      organizationId: organizationId?.trim() || null,
    });
  }

  setApprovalRequestId(approvalRequestId?: string | null) {
    updateRequestContext({
      approvalRequestId: approvalRequestId?.trim() || null,
    });
  }

  setUserId(userId?: string | null) {
    updateRequestContext({
      userId: userId?.trim() || null,
    });
  }

  setContext(partial: Partial<RequestContextState>) {
    updateRequestContext(partial);
  }
}
