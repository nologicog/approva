import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextState {
  requestId: string;
  organizationId: string | null;
  approvalRequestId: string | null;
  userId: string | null;
  method?: string | null;
  path?: string | null;
}

const requestContextStorage = new AsyncLocalStorage<RequestContextState>();

export function runWithRequestContext<T>(
  initialState: RequestContextState,
  callback: () => T,
) {
  return requestContextStorage.run(initialState, callback);
}

export function getRequestContext() {
  return requestContextStorage.getStore() ?? null;
}

export function updateRequestContext(partial: Partial<RequestContextState>) {
  const store = requestContextStorage.getStore();

  if (!store) {
    return;
  }

  Object.assign(store, partial);
}
