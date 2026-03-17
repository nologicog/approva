import { HomePage } from '@/components/home-page';
import { getAuthonRuntimeMode } from '@/lib/runtime-mode';

export default function LandingPageRoute() {
  return <HomePage runtimeMode={getAuthonRuntimeMode()} />;
}
