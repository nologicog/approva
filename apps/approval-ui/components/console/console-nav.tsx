'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ConsoleNavLink {
  href: string;
  label: string;
}

export function ConsoleNav({ links }: { links: ConsoleNavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="console-nav">
      {links.map((link) => {
        const isActive =
          link.href === '/demo/ai-deploy'
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            className={`console-nav-link${isActive ? ' active' : ''}`}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
