// src/app/features/bests/components/PBOcr.tsx
"use client";

import PBDistancePanel from "@/app/features/bests/components/PBDistancePanel";
import { useFavoritePBOcr } from "@/app/features/bests/hooks/useFavoritePBOcr";
import { useT } from "@/app/shared/i18n/useT";

export default function PBOcr() {
  const { favM, setFavM } = useFavoritePBOcr();
  const t = useT();

  return (
    <PBDistancePanel
      sport="ocr"
      title="Spartan Race"
      subtitle={t("PB.ocr.subtitle") as any}
      activitySports={["run", "mixed"]}
      totalDistanceMax={200}
      favM={favM ?? 5000}
      setFavM={setFavM}
    />
  );
}