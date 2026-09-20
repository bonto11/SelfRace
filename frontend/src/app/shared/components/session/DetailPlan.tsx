// src/app/shared/components/session/DetailPlan.tsx
"use client";

import { useMemo } from "react";
import type { ComponentVariant } from "@/app/features/activities/types/activities";
import SectionTrainingStructure, {
  hasTrainingStructure,
} from "@/app/shared/components/session/SectionTrainingStructure";
import SectionStrengthLog from "@/app/shared/components/session/SectionStrengthLog";
import { safeText } from "@/app/shared/components/session/sessionUtils";
import type { SessionItem } from "@/app/shared/components/session/SessionCard";
import { useT } from "@/app/shared/i18n/useT";
import SectionPreview from "@/app/shared/components/session/SectionPreview";

export default function DetailPlan({
  item,
  showPlanDebug,
  showAdvanced = false,
}: {
  variant?: ComponentVariant;
  item: SessionItem;
  showPlanDebug: boolean;
  showAdvanced?: boolean;
}) {
  const t = useT();

  const raw = item.planRaw ?? undefined;
  const structure = item.planStructure ?? raw?.structure ?? undefined;

  const hasStrength = useMemo(() => {
    const s: any = structure;
    if (!s || typeof s !== "object") return false;
    return (
      (Array.isArray(s.activation) && s.activation.length > 0) ||
      (Array.isArray(s.strength_main_part) && s.strength_main_part.length > 0) ||
      (Array.isArray(s.add_ons) && s.add_ons.length > 0)
    );
  }, [structure]);

  // 🌟 Zápis odcvičených sérií povolíme len pre dnešné a minulé session -
  // pri budúcich naplánovaných tréningoch by inputy nedávali zmysel,
  // tam ostáva čisté zobrazenie plánu.
  const isLoggable = useMemo(() => {
    if (!item.dateIso) return false;
    const today = new Date().toISOString().slice(0, 10);
    return String(item.dateIso).slice(0, 10) <= today;
  }, [item.dateIso]);

  return (
    <div className="space-y-4">
      {/* --- POZNÁMKA TRÉNERA K PLÁNU --- */}
      {(item.planNotes || item.notes) && (
        <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-sm text-white/80 leading-relaxed">
          {safeText(item.planNotes || item.notes)}
        </div>
      )}

      {/* --- SEKCIA: ŠTRUKTÚRA TRÉNINGU (Endurance) --- */}
      {hasTrainingStructure(structure) && (
        <SectionTrainingStructure
          structure={structure}
          sport={item.sport}
          showAdvanced={showAdvanced}
          status={item.status}
        />
      )}

      {/* --- SEKCIA: CVIKY (Strength) + zápis odcvičeného --- */}
      {hasStrength && item.planId != null && (
        <SectionStrengthLog
          sessionId={Number(item.planId)}
          structure={structure}
          isLoggable={isLoggable}
          showAdvanced={showAdvanced}
          defaultOpen={item.status !== "done"}
        />
      )}

      {/* --- SEKCIA: SESSION PREVIEW (konverzácia s trénerom k tejto session) --- */}
      {item.id != null && (
        <SectionPreview
          sessionId={Number(item.id)}
          isEditable={item.status === "planned" && item.activityId == null}
          initialThread={(raw as any)?.preview_thread ?? []}
        />
      )}
    </div>
  );
}