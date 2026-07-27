// src/app/features/bests/components/PBRun.tsx
"use client";

import PBDistancePanel from "@/app/features/bests/components/PBDistancePanel";
import { useFavoritePBRun } from "@/app/features/bests/hooks/useFavoritePBRun";
import { useT } from "@/app/shared/i18n/useT";

export default function PBRun() {
  const { favM, setFavM } = useFavoritePBRun();
  const t = useT();

  return (
    <PBDistancePanel
      sport="run"
      title={t("PB.run.title") || "Beh"}
      subtitle={t("PB.run.subtitle") as any}
      activitySports={["run", "mixed"]}
      totalDistanceMax={200}
      favM={favM ?? 5000}
      setFavM={setFavM}
    />
  );
}