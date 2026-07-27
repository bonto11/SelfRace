// src/app/features/bests/components/PBTriathlon.tsx
"use client";

import PBDistancePanel from "@/app/features/bests/components/PBDistancePanel";
import { useFavoritePBTriathlon } from "@/app/features/bests/hooks/useFavoritePBTriathlon";
import { useT } from "@/app/shared/i18n/useT";

export default function PBTriathlon() {
  const { favM, setFavM } = useFavoritePBTriathlon();
  const t = useT();

  return (
    <PBDistancePanel
      sport="triathlon"
      title={t("PB.triathlon.title") || "Triatlon"}
      subtitle={t("PB.triathlon.subtitle") as any}
      activitySports={["triathlon", "mixed", "workout"]}
      totalDistanceMax={500}
      favM={favM ?? 51500}
      setFavM={setFavM}
    />
  );
}