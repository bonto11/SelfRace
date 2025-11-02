"use client";

import PrefsForm from "@/features/coach/components/PrefsForm";
import { CoachDataProvider } from "@/shared/components/dataProviders/CoachDataProvider";
import ButtonBack from "@/shared/components/ui/ButtonBack";

export default function Page() {
  return (
    <CoachDataProvider>
      <div className="max-w-screen-lg mx-auto px-3">
        <ButtonBack title="Coach — Preferences" />

        <div className="pt-3 bg-white/5 dark:bg-gray-800 p-4 rounded shadow">
          <PrefsForm />
        </div>
      </div>
    </CoachDataProvider>
  );
}