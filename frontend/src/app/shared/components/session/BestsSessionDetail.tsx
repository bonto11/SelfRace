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