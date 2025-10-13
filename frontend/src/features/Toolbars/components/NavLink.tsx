'use client';
import Link, { LinkProps } from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export default function NavLink({
  href,
  children,
  onClick,
}: LinkProps & { children: ReactNode; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = typeof href === 'string'
    ? pathname === href || pathname.startsWith(String(href) + '/')
    : false;

  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        'block px-3 py-2 rounded',
        isActive ? 'bg-neutral-800 text-white' : 'hover:bg-neutral-800',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}
