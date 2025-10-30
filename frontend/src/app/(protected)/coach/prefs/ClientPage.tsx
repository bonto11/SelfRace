"use client";

import { CoachDataProvider } from "@/features/coach/data/CoachDataProvider";
import CoachPrefsPanel from "@/features/coach/components/CoachPrefsPanel";

export default function ClientPage() {
  return (
    <CoachDataProvider>
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-semibold">Preferences</h1>
        <CoachPrefsPanel />
      </div>
    </CoachDataProvider>
  );
}