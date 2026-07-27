// src/app/features/bests/components/PBHyrox.tsx
"use client";

import PBDistancePanel from "@/app/features/bests/components/PBDistancePanel";
import { useFavoritePBHyrox } from "@/app/features/bests/hooks/useFavoritePBHyrox";
import { useT } from "@/app/shared/i18n/useT";

export default function PBHyrox() {
  const { favM, setFavM } = useFavoritePBHyrox();
  const t = useT();

  return (
    <PBDistancePanel
      sport="hyrox"
      title="Hyrox"
      subtitle={t("PB.hyrox.subtitle") as any}
      activitySports={["workout", "mixed"]}
      totalDistanceMax={200}
      favM={favM ?? 1}
      setFavM={setFavM}
    />
  );
}