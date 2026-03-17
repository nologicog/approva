'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { ApprovalRequestPage } from '@/components/approval-request-page';

export default function ApprovalRequestRoute() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  return (
    <ApprovalRequestPage
      requestId={params.id}
      approvalAccessToken={searchParams.get('token')}
    />
  );
}
