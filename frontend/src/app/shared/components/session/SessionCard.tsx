"use client";

import { useEffect, useMemo, useState } from "react";

import SportBadge from "@/app/shared/ui/components/SportBadge";
import { ComponentVariant } from "@/app/features/activities/types/activities";
import { ActivitySessionDetail } from "@/app/shared/components/session/ActivitySessionDetail";
import PlanSessionDetail from "@/app/shared/components/session/PlanSessionDetail";
import ExternalSessionDetail from "@/app/shared/components/session/ExternalSessionDetail";
import BestsSessionDetail from "@/app/shared/components/session/BestsSessionDetail";
import { MetricGrid } from "@/app/shared/components/session/MetricGrid";
import { safeText } from "@/app/shared/components/session/sessionUtils";

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
  SESSION_CARD_HOVER,
  SESSION_VARIANT_PAD,

  SESSION_HEAD,
  SESSION_BODY,

  SESSION_HEAD_ROW,
  SESSION_HEAD_LEFT,
  SESSION_HEAD_RIGHT,

  SESSION_DATE,
  SESSION_TITLE,
  SESSION_SUBTITLE,

  SESSION_FAVORITE_STAR,

  SESSION_PILL,
  SESSION_PLAN_STATUS_STYLE,

  SESSION_TOGGLE_BTN,
  SESSION_TOGGLE_BTN_STYLE,
  SESSION_TOGGLE_BTN_HOVER,
  SESSION_TOGGLE_ICON,

  SESSION_FLUSH_DETAIL,
  SESSION_FLUSH_DETAIL_STYLE,
} from "@/app/shared/ui/tokens";

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
  variant?: ComponentVariant;
  item: SessionCardItem;
  onOpenActivity?: (activityId: number) => void;
  showPlanDebug?: boolean;
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
      className={[SESSION_CARD, SESSION_CARD_HOVER, SESSION_VARIANT_PAD[variant]].join(" ")}
      style={SESSION_CARD_STYLE}
    >
      {/* HEADER */}
      <div className={SESSION_HEAD}>
        <div className={SESSION_HEAD_ROW}>
          <div className={SESSION_HEAD_LEFT}>
            {dateLine && <div className={SESSION_DATE}>{dateLine}</div>}

            <div className="min-w-0">
              <div className={SESSION_TITLE}>{item.title}</div>

              {secondaryLine && (
                <div className={SESSION_SUBTITLE}>{secondaryLine}</div>
              )}
            </div>
          </div>

          <div className={SESSION_HEAD_RIGHT}>
            {item.kind === "activity" && (item as ActivitySession).isFavorite && (
              <span className={SESSION_FAVORITE_STAR} title="Favorite">
                ★
              </span>
            )}

            {item.kind === "plan" && (
              <span
                className={SESSION_PILL}
                style={SESSION_PLAN_STATUS_STYLE[(item as PlanSession).status]}
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
              className={[SESSION_TOGGLE_BTN, SESSION_TOGGLE_BTN_HOVER].join(" ")}
              style={SESSION_TOGGLE_BTN_STYLE}
            >
              <span
                className={[
                  SESSION_TOGGLE_ICON,
                  opened ? "rotate-180" : "",
                ].join(" ")}
              >
                ▾
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL */}
      {opened && (
        <div className={SESSION_FLUSH_DETAIL} style={SESSION_FLUSH_DETAIL_STYLE}>
          <div className={SESSION_BODY}>
            <DetailBody
              variant={variant}
              item={item}
              onOpenActivity={onOpenActivity}
              showPlanDebug={showPlanDebug}
            />
          </div>
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
  const compactChart = variant !== "activity";

  const kpis = Array.isArray(item.kpis) ? item.kpis : [];
  const hasKpis = kpis.length > 0;

  const kpiBlock = hasKpis ? (
    <MetricGrid
      cols={4}
      metrics={kpis.map((k) => ({
        label: safeText(k.label),
        value: safeText(k.value),
      }))}
    />
  ) : null;

  if (item.kind === "plan") {
    return (
      <PlanSessionDetail
        variant={variant}
        item={item as any}
        showPlanDebug={showPlanDebug}
      />
    );
  }

  if (item.kind === "external") {
    return <ExternalSessionDetail variant={variant} item={item as any} />;
  }

  if (item.kind === "bests") {
    return (
      <BestsSessionDetail
        item={item as any}
        kpiBlock={kpiBlock}
        hasKpis={hasKpis}
        compactChart={compactChart}
        onOpenActivity={onOpenActivity}
      />
    );
  }

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