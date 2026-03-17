'use client';

import { useParams } from 'next/navigation';
import { ConsoleApprovalDetailPage } from '@/components/console/console-approval-detail-page';

export default function ConsoleApprovalDetailRoute() {
  const params = useParams<{ id: string }>();

  return <ConsoleApprovalDetailPage approvalRequestId={params.id} />;
}
