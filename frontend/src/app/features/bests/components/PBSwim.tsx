// src/app/features/bests/components/PBSwim.tsx
"use client";

import PBDistancePanel from "@/app/features/bests/components/PBDistancePanel";
import { useFavoritePBSwim } from "@/app/features/bests/hooks/useFavoritePBSwim";
import { useT } from "@/app/shared/i18n/useT";

export default function PBSwim() {
  const { favM, setFavM } = useFavoritePBSwim();
  const t = useT();

  return (
    <PBDistancePanel
      sport="swim"
      title={t("PB.swim.title") || "Plávanie"}
      subtitle={t("PB.swim.subtitle") as any}
      activitySports={["swimming", "mixed"]}
      totalDistanceMax={50}
      favM={favM ?? 1000}
      setFavM={setFavM}
    />
  );
}