"use client";

import PrefsForm from "@/features/coach/components/PrefsForm";
import { CoachDataProvider } from "@/shared/components/dataProviders/CoachDataProvider";
import ButtonBack from "@/shared/components/ui/ButtonBack";

export default function ClientPage() {
  return (
    <CoachDataProvider>
      <div className="max-w-screen-lg mx-auto px-3">
        <div className="sticky top-[max(env(safe-area-inset-top),0px)] z-20 -mx-3 px-3 pt-2 pb-2 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40">
          <div className="flex items-center gap-3">
            <ButtonBack href="/coach" label="Späť na Coach" />
            <h1 className="text-lg font-semibold">Coach — Preferences</h1>
          </div>
        </div>

        <div className="pt-3 bg-white/5 dark:bg-gray-800 p-4 rounded shadow">
          <PrefsForm />
        </div>
      </div>
    </CoachDataProvider>
  );
}