import { HelpPage } from '@/components/help-page';
import { getAuthonRuntimeMode } from '@/lib/runtime-mode';

export default function HelpRoute() {
  return <HelpPage runtimeMode={getAuthonRuntimeMode()} />;
}
