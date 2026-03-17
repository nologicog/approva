import { ConsoleApprovalsPage } from '@/components/console/console-approvals-page';
import { getAuthonRuntimeMode } from '@/lib/runtime-mode';

export default function ConsoleApprovalsRoute() {
  return <ConsoleApprovalsPage runtimeMode={getAuthonRuntimeMode()} />;
}
