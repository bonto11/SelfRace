// src/features/bests/components/AccordionBests.tsx
"use client";

import dynamic from "next/dynamic";
import { PANEL_STACK } from "@/app/shared/ui/tokens";

const PBRun = dynamic(() => import("@/app/features/bests/components/PBRun"), { ssr: false });
const PBBike = dynamic(() => import("@/app/features/bests/components/PBBike"), { ssr: false });
const PBSwim = dynamic(() => import("@/app/features/bests/components/PBSwim"), { ssr: false });
const PBTriathlon = dynamic(() => import("@/app/features/bests/components/PBTriathlon"), { ssr: false });
const PBOcr = dynamic(() => import("@/app/features/bests/components/PBOcr"), { ssr: false });
const PBHyrox = dynamic(() => import("@/app/features/bests/components/PBHyrox"), { ssr: false });
const PBStrength = dynamic(() => import("@/app/features/bests/components/PBStrength"), { ssr: false });

export default function AccordionBests() {
  return (
    <div className={PANEL_STACK}>
      <PBRun />
      <PBBike />
      <PBSwim />
      <PBTriathlon />
      <PBOcr />
      <PBHyrox />
      <PBStrength />
    </div>
  );
}
