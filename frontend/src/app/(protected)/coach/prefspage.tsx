"use client";

import PrefsDetailForm from "@/features/coach/components/PrefsDetailForm";
import Link from "next/link";

export default function CoachPrefsPage() {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Coach AI — Preferences</h2>
        <Link href="/coach" className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm">Späť</Link>
      </div>
      <PrefsDetailForm />
    </div>
  );
}