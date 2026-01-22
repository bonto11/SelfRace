"use client";

import { useEffect, useMemo, useState } from "react";

import SportBadge from "@/app/shared/components/ui/SportBadge";
import {
  SURFACE_CARD,
  SURFACE_INLINE,
  FLUSH_DETAIL,
} from "@/app/shared/ui/tokens";
import { ComponentVariant } from "@/app/features/activities/types/activities";

import { ActivitySessionDetail } from "@/app/shared/components/session/ActivitySessionDetail";
import PlanSessionDetail from "@/app/shared/components/session/PlanSessionDetail";
import ExternalSessionDetail from "@/app/shared/components/session/ExternalSessionDetail";
import BestsSessionDetail from "@/app/shared/components/session/BestsSessionDetail";

import { safeText } from "@/app/shared/components/session/sessionUtils";

/** ========== Types ========== */

export type SessionKind = "activity" | "plan" | "external" | "bests";
export type PlanStatus = "planned" | "done" | "missed";

export type KPI = { label: string; value: any };

type Base = {
  id: string | number;
  kind: SessionKind;
  title: string;
  dateIso?: string | null;
  sport: string;

  defaultOpen?: boolean;
  hideDateLine?: boolean;

  subtitle?: string | null;
  kpis?: KPI[];
  notes?: string | null;
};

export type ActivitySession = Base & {
  kind: "activity";
  activityId: number;

  timeStr?: string | null;
  distanceStr?: string | null;
  avgHr?: number | null;
  maxHr?: number | null;

  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

// PB – vlastný typ, ale polia sú rovnaké ako pri activity,
// aby si vedel ľahko linknúť späť na konkrétnu aktivitu.
export type BestsSession = Base & {
  kind: "bests";
  activityId: number;

  timeStr?: string | null;
  distanceStr?: string | null;
  avgHr?: number | null;
  maxHr?: number | null;
};

export type PlanSession = Base & {
  kind: "plan";
  status: PlanStatus;

  planDur?: string | null;
  planIntensity?: string | null;
  planTarget?: string | null;
  planNotes?: string | null;

  planRaw?: any;
  planStructure?: any;
  planExercises?: any[];
};

export type ExternalSession = Base & {
  kind: "external";
  time?: string | null;
  durationMin?: number | null;
  notes?: string | null;
};

export type SessionCardItem =
  | ActivitySession
  | BestsSession
  | PlanSession
  | ExternalSession;

export type SessionCardProps = {
  variant?: ComponentVariant; // "activity" | "calendar" | "pb" | "plan"
  item: SessionCardItem;
  onOpenActivity?: (activityId: number) => void;
  showPlanDebug?: boolean;
};

const PRESET: Record<
  ComponentVariant,
  { outerPadding: string; compactChart: boolean }
> = {
  activity: { outerPadding: "px-5 py-4", compactChart: false },
  calendar: { outerPadding: "px-5 py-4", compactChart: true },
  pb: { outerPadding: "px-5 py-4", compactChart: true },
  plan: { outerPadding: "px-5 py-4", compactChart: true },
};

/** ========== Helpers ========== */

function prettySkDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const wk = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wk} · ${day}`;
}

function statusLabel(status: PlanStatus): string {
  if (status === "done") return "hotovo";
  if (status === "missed") return "missed";
  return "planned";
}
function statusCls(status: PlanStatus): string {
  if (status === "done")
    return "border-emerald-500/80 text-emerald-300 bg-emerald-500/5";
  if (status === "missed")
    return "border-orange-500/80 text-orange-300 bg-orange-500/5";
  return "border-slate-500/80 text-slate-200 bg-slate-500/5";
}

function parseKm(s?: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(-?\d+(?:[.,]\d+)?)\s*km/i);
  if (!m) return null;
  return Number(String(m[1]).replace(",", "."));
}

/** ========== Component ========== */

export default function SessionCard({
  variant = "activity",
  item,
  onOpenActivity,
  showPlanDebug = false,
}: SessionCardProps) {
  const cfg = PRESET[variant];
  const [opened, setOpened] = useState<boolean>(!!item.defaultOpen);

  useEffect(() => {
    if (item.defaultOpen) setOpened(true);
  }, [item.defaultOpen]);

  const dateLine =
    item.hideDateLine || variant === "calendar"
      ? ""
      : prettySkDate(item.dateIso);

  const secondaryLine = useMemo(() => {
    if (variant === "calendar" && item.subtitle) return item.subtitle;

    switch (item.kind) {
      case "activity":
      case "bests": {
        const act = item as ActivitySession | BestsSession;
        const distKm = parseKm(act.distanceStr);
        if (distKm != null && distKm > 0 && act.distanceStr)
          return `Distance ${act.distanceStr}`;
        if (act.timeStr) return `Time ${act.timeStr}`;
        return null;
      }

      case "plan": {
        const plan = item as PlanSession;
        const bits = [
          plan.planDur ?? "",
          plan.planIntensity ?? "",
          plan.planTarget ?? "",
        ].filter(Boolean);
        return bits.length ? bits.join(" · ") : null;
      }

      case "external": {
        const ext = item as ExternalSession;
        const bits = [
          ext.time ? ext.time : null,
          ext.durationMin != null ? `${ext.durationMin} min` : null,
        ].filter(Boolean);
        return bits.length ? bits.join(" · ") : null;
      }

      default:
        return null;
    }
  }, [item, variant]);

  return (
    <section
      className={[SURFACE_CARD, "overflow-hidden", cfg.outerPadding].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium truncate">{dateLine}</div>

        <div className="flex items-center gap-2">
          {item.kind === "activity" && (item as ActivitySession).isFavorite && (
            <span
              className="text-[12px] leading-none opacity-90"
              title="Favorite"
            >
              ★
            </span>
          )}

          {item.kind === "plan" && (
            <span
              className={[
                "inline-flex items-center justify-center rounded-full text-[10px] px-2 py-0.5 border",
                statusCls((item as PlanSession).status),
              ].join(" ")}
            >
              {statusLabel((item as PlanSession).status)}
            </span>
          )}

          <SportBadge sport={item.sport} />

          <button
            type="button"
            aria-expanded={opened}
            onClick={() => setOpened((s) => !s)}
            title={opened ? "Skryť detail" : "Otvoriť detail"}
            className="h-8 w-8 grid place-items-center rounded-full border border-white/10 bg-white/10 hover:bg-white/20 transition-colors"
          >
            <span
              className={[
                "text-base leading-none select-none transition-transform",
                opened ? "rotate-180" : "",
              ].join(" ")}
            >
              ▾
            </span>
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="mt-1 text-base font-semibold tracking-tight truncate">
        {item.title}
      </div>

      {/* Secondary line */}
      {secondaryLine && (
        <div className="text-sm mt-1 opacity-80">{secondaryLine}</div>
      )}

      {/* Detail */}
      {opened && (
        <div className={FLUSH_DETAIL}>
          <DetailBody
            variant={variant}
            item={item}
            onOpenActivity={onOpenActivity}
            showPlanDebug={showPlanDebug}
          />
        </div>
      )}
    </section>
  );
}

/** ========== Detail router ========== */

function DetailBody({
  variant,
  item,
  onOpenActivity,
  showPlanDebug,
}: {
  variant: ComponentVariant;
  item: SessionCardItem;
  onOpenActivity?: (activityId: number) => void;
  showPlanDebug: boolean;
}) {
  const compactChart = PRESET[variant].compactChart;

  const kpis = Array.isArray(item.kpis) ? item.kpis : [];
  const hasKpis = kpis.length > 0;

  const kpiBlock = hasKpis ? (
    <div className="mt-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <div
          key={String(k.label)}
          className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
        >
          <div className="text-[10px] opacity-70">{safeText(k.label)}</div>
          <div className="text-xl font-semibold tabular-nums">
            {safeText(k.value)}
          </div>
        </div>
      ))}
    </div>
  ) : null;

  // PLAN
  if (item.kind === "plan") {
    return (
      <PlanSessionDetail
        variant={variant}
        item={item as PlanSession}
        showPlanDebug={showPlanDebug}
      />
    );
  }

  // EXTERNAL
  if (item.kind === "external") {
    return (
      <ExternalSessionDetail variant={variant} item={item as ExternalSession} />
    );
  }

  // BESTS
  if (item.kind === "bests") {
    return (
      <BestsSessionDetail
        item={item as BestsSession}
        kpiBlock={kpiBlock}
        hasKpis={hasKpis}
        compactChart={compactChart}
        onOpenActivity={onOpenActivity}
      />
    );
  }

  // ACTIVITY
  const act = item as ActivitySession;

  return (
    <ActivitySessionDetail
      item={act}
      kpiBlock={kpiBlock}
      hasKpis={hasKpis}
      compactChart={compactChart}
      onOpenActivity={onOpenActivity}
    />
  );
}
