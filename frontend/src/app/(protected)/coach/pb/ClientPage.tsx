"use client";

import { CoachDataProvider } from "@/shared/components/dataProviders/CoachDataProvider";
import AccordionBests from "@/shared/components/pb/AccordionBests";
import ButtonBack from "@/shared/components/ui/ButtonBack";

export default function PersonalBestsPage() {
  return (
    <CoachDataProvider>
      <div className="max-w-screen-lg mx-auto px-3">
        <div className="sticky top-[max(env(safe-area-inset-top),0px)] z-20 -mx-3 px-3 pt-2 pb-2 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold truncate">Personal Bests</h1>
            <div className="ml-auto">
              <ButtonBack href="/coach" label="Späť" />
            </div>
          </div>
        </div>

        <div className="pt-3">
          <AccordionBests />
        </div>
      </div>
    </CoachDataProvider>
  );
}