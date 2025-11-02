"use client";

import { CoachDataProvider } from "@/shared/components/dataProviders/CoachDataProvider";
import AccordionBests from "@/shared/components/pb/AccordionBests";
import ButtonBack from "@/shared/components/ui/ButtonBack";

export default function Page() {
  return (
    <CoachDataProvider>
      <div className="max-w-screen-lg mx-auto px-3">
        <ButtonBack title="Personal Bests" href="/coach" />

        <div className="pt-3">
          <AccordionBests />
        </div>
      </div>
    </CoachDataProvider>
  );
}