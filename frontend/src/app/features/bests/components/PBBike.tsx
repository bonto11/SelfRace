// src/app/features/bests/components/PBBike.tsx
"use client";

import PBDistancePanel from "@/app/features/bests/components/PBDistancePanel";
import { useFavoritePBRide } from "@/app/features/bests/hooks/useFavoritePBRide";
import { useT } from "@/app/shared/i18n/useT";

export default function PBBike() {
  const { favM, setFavM } = useFavoritePBRide();
  const t = useT();

  return (
    <PBDistancePanel
      sport="ride"
      title={t("PB.bike.title") || "Cyklistika"}
      subtitle={t("PB.bike.subtitle") as any}
      activitySports={["ride", "virtualride", "mixed"]}
      totalDistanceMax={500}
      favM={favM ?? 20000}
      setFavM={setFavM}
    />
  );
}