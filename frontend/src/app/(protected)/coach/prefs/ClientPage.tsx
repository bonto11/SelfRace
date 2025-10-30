"use client";

import Link from "next/link";
import PrefsForm from "@/features/coach/components/PrefsForm";
import { CoachDataProvider } from "@/features/coach/data/CoachDataProvider";

export default function ClientPage() {
  return (
    <CoachDataProvider>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Coach — Preferences</h1>
        <Link
          href="/coach"
          className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600"
        >
          ← Späť na Coach
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
        <PrefsForm />
      </div>
    </CoachDataProvider>
  );
}