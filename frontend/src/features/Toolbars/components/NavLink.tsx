// src/features/Toolbars/components/NavLink.tsx
'use client';
import Link, { LinkProps } from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { NAV_ITEM, NAV_ITEM_ACTIVE } from '@/shared/ui/classes';

export default function NavLink({
  href,
  children,
  onClick,
}: LinkProps & { children: ReactNode; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive =
    typeof href === 'string'
      ? pathname === href || pathname.startsWith(String(href) + '/')
      : false;

  return (
    <Link
      href={href}
      onClick={onClick}
      className={[NAV_ITEM, isActive ? NAV_ITEM_ACTIVE : ''].join(' ')}
    >
      {children}
    </Link>
  );
}