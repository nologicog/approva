import Link from 'next/link';
import { getAuthonReleaseLabel, getAuthonRuntimeMode } from '@/lib/runtime-mode';

const LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/security', label: 'Security' },
  { href: '/help', label: 'Help' },
];

export function SiteFooter() {
  const runtimeMode = getAuthonRuntimeMode();
  const releaseLabel = getAuthonReleaseLabel();

  return (
    <footer className="site-footer">
      <div className="site-footer-copy">
        <span className="eyebrow">
          Approva · {runtimeMode === 'open-core' ? 'Open Core' : 'Authenticated Console'} · {releaseLabel}
        </span>
        <p>
          Human approval infrastructure for AI actions, packaged here as a self-hostable open-core
          runtime.
        </p>
      </div>

      <nav aria-label="Footer" className="site-footer-links">
        {LINKS.map((link) => (
          <Link href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
