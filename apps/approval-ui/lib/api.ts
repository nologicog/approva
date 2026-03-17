import { ApprovalClient } from '@approva/sdk';

export function getApprovalClient() {
  return new ApprovalClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
    credentials: 'include',
  });
}
