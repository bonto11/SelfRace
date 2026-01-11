"use client";

import { ReactNode } from "react";
import { ActivitySessionDetail } from "@/app/shared/components/session/ActivitySessionDetail";
import type {
  BestsSession,
} from "@/app/shared/components/session/SessionCard";

type Props = {
  item: BestsSession;
  kpiBlock: ReactNode | null;
  hasKpis: boolean;
  compactChart: boolean;
  onOpenActivity?: (activityId: number) => void;
};

export default function BestsSessionDetail({
  item,
  kpiBlock,
  hasKpis,
  compactChart,
  onOpenActivity,
}: Props) {
  // teraz 1:1 ako activity; keď budeš chcieť iný layout PB,
  // zmeníš to tu a SessionCard sa nemusí meniť.
  return (
    <ActivitySessionDetail
      // typovo je to veľmi podobné ActivitySession, takže cast je OK
      item={item as any}
      kpiBlock={kpiBlock}
      hasKpis={hasKpis}
      compactChart={compactChart}
      onOpenActivity={onOpenActivity}
    />
  );
}