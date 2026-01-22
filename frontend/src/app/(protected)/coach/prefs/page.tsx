"use client";

import CoachPreferencies from "@/app/features/prefs/components/CoachPreferencies";
import ButtonBack from "@/app/shared/components/ui/AppHeader";

export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="Coach — Preferences" />

      <div className="pt-3 bg-white/5 dark:bg-gray-800 p-4 rounded shadow">
        <CoachPreferencies />
      </div>
    </div>
  );
}
