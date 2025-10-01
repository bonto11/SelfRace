// src/features/nav/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/activities", label: "Activities" },
  { href: "/coach", label: "AI Coach" },
  { href: "/recovery", label: "Recovery" },
  { href: "/profile", label: "Profile" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 shrink-0 border-r min-h-dvh p-3">
      <nav className="w-full space-y-1">
        {links.map((l) => {
          const active =
            l.href === "/"
              ? pathname === "/"
              : pathname === l.href || pathname?.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`block rounded px-3 py-2 hover:bg-white/10 ${
                active ? "bg-white/10 font-medium" : ""
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/*

"use client";

import Link from "next/link";
import { Home, Activity, User, HeartPulse, Settings, Dumbbell } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/activities", label: "Activities", icon: Activity },
  { href: "/coach", label: "Coach", icon: Dumbbell },
  { href: "/recovery", label: "Recovery", icon: HeartPulse },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  return (
    <div className="w-64 bg-gray-900 text-white h-screen p-4 flex flex-col">
      <h1 className="text-2xl font-bold mb-6">Trainalyze</h1>

      <nav className="flex-1 space-y-2">
        <Link href="/" className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700">
          <Home size={18} />
          <span>Home</span>
        </Link>

        <Link href="/activities" className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700">
          <Activity size={18} />
          <span>Activities</span>
        </Link>

        <Link href="/coach" className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700">
          <Dumbbell size={18} />
          <span>AI Coach</span>
        </Link>

        <Link href="/recovery" className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700">
          <HeartPulse size={18} />
          <span>Recovery</span>
        </Link>

        <Link href="/profile" className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700">
          <User size={18} />
          <span>Profile</span>
        </Link>

        <Link href="/settings" className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700">
          <Settings size={18} />
          <span>Settings</span>
        </Link>
      </nav>
    </div>
  );
}
*/