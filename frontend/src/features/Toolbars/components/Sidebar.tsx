// src/features/Toolbars/Sidebar.tsx
'use client';
import Link from 'next/link';
import { useSidebar } from '@/features/Toolbars/hooks/useSidebar';

export default function Sidebar() {
  const { setOpen } = useSidebar();

  return (
    <nav
      className="
        h-full w-[280px] bg-neutral-900 text-neutral-100
        lg:static lg:translate-x-0 lg:shadow-none
      "
      onClick={() => setOpen(false)} // zatvor po kliku v mobile
    >
      <div className="p-4 font-bold">SelfRace</div>
      <ul className="space-y-1 px-2 pb-4">
        <li><Link className="block px-3 py-2 rounded hover:bg-neutral-800" href="/dashboard">Dashboard</Link></li>
        <li><Link className="block px-3 py-2 rounded hover:bg-neutral-800" href="/activities">Activities</Link></li>
        <li><Link className="block px-3 py-2 rounded hover:bg-neutral-800" href="/recovery">Recovery</Link></li>
        <li><Link className="block px-3 py-2 rounded hover:bg-neutral-800" href="/coach">AI Coach</Link></li>
        <li><Link className="block px-3 py-2 rounded hover:bg-neutral-800" href="/profile">Profile</Link></li>
      </ul>
    </nav>
  );
}
