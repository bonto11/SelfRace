// src/app/shared/components/session/BestsSessionDetail.tsx
"use client";

import { ReactNode } from "react";
import { ActivitySessionDetail } from "@/app/shared/components/session/DetailActivity";
import type { BestsSession } from "@/app/shared/components/session/SessionCard";

type Props = {
  item: BestsSession;
  kpiBlock: ReactNode | null;
  hasKpis: boolean;
  compactChart: boolean;
  onOpenActivity?: (activityId: number) => void;
};

export default function DetailBests({
  item,
  kpiBlock,
  hasKpis,
  compactChart,
  onOpenActivity,
}: Props) {
  return (
    <ActivitySessionDetail
      item={item as any}
      kpiBlock={kpiBlock}
      hasKpis={hasKpis}
      compactChart={compactChart}
      onOpenActivity={onOpenActivity}
    />
  );
}
