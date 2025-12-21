"use client";

import CoachPreferencies from "@/features/coach/components/CoachPreferencies";
import ButtonBack from "@/app/shared/components/ui/ButtonBack";

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
