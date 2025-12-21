"use client";

import AccordionBests from "@/features/bests/components/AccordionBests";
import ButtonBack from "@/shared/components/ui/ButtonBack";

export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="Personal Bests" />

      <div className="pt-3">
        <AccordionBests />
      </div>
    </div>
  );
}
