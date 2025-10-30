"use client";

import Link from "next/link";
import { CoachDataProvider } from "@/features/coach/data/CoachDataProvider";
import PrefsForm from "@/features/coach/components/PrefsForm";

export default function CoachPrefsClient() {
  return (
    <CoachDataProvider>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Preferences</h1>
          <Link
            href="/coach"
            className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm"
          >
            Späť
          </Link>
        </div>

        <PrefsForm />
      </div>
    </CoachDataProvider>
  );
}