"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { THEME } from "@/app/shared/theme/tokens";
import {
  apiGetLatestAthleteProgress,
  type AthleteProgressRecord,
} from "@/app/features/coach/api/coach_athlete_state";

type Props = {
  onOpenDetail?: () => void;
};

type UiState = {
  hasData: boolean;
  comparedAt: string | null;
  headline: string | null;
  bullets: string[];
  fatigueLabel: string | null;
  injuryLabel: string | null;
  blockLabel: string | null;
  volumeLabel: string | null;
};

function toStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  return [];
}

function slovakLevel(level?: string | null): string {
  const l = (level || "").toLowerCase();
  if (!l) return "—";
  if (l === "low") return "nízka";
  if (l === "moderate") return "stredná";
  if (l === "high") return "vysoká";
  return l;
}

function buildUiState(row: AthleteProgressRecord | null): UiState {
  if (!row || !row.compare_previous) {
    return {
      hasData: false,
      comparedAt: null,
      headline: null,
      bullets: [],
      fatigueLabel: null,
      injuryLabel: null,
      blockLabel: null,
      volumeLabel: null,
    };
  }

  const cp: any = row.compare_previous;

  const headline: string | null =
    cp.summary?.headline || cp.headline || null;

  const bullets: string[] =
    toStringArray(cp.summary?.bullets) || toStringArray(cp.summary_bullets);

  const comp = cp.comparisons || {};
  const fatigue = comp.fatigue_level || {};
  const injury = comp.injury_risk || {};
  const block = comp.block_kind || {};
  const vol = comp.volume_tolerance || {};

  const fatigueLabel =
    fatigue.previous || fatigue.current
      ? `${slovakLevel(fatigue.previous)} → ${slovakLevel(fatigue.current)}`
      : null;

  const injuryLabel =
    injury.previous || injury.current
      ? `${slovakLevel(injury.previous)} → ${slovakLevel(injury.current)}`
      : null;

  const blockLabel =
    block.previous || block.current
      ? `${block.previous || "—"} → ${block.current || "—"}`
      : null;

  let volumeLabel: string | null = null;
  if (
    (typeof vol.previous_weekly_minutes_min === "number" &&
      typeof vol.current_weekly_minutes_min === "number") ||
    (typeof vol.previous_weekly_minutes_max === "number" &&
      typeof vol.current_weekly_minutes_max === "number")
  ) {
    const fromMin = vol.previous_weekly_minutes_min;
    const toMin = vol.current_weekly_minutes_min;
    const fromH =
      typeof fromMin === "number" ? Math.round(fromMin / 60) : null;
    const toH = typeof toMin === "number" ? Math.round(toMin / 60) : null;

    if (fromH != null && toH != null) {
      volumeLabel = `${fromH} h → ${toH} h / týždeň (min)`;
    } else {
      volumeLabel = null;
    }
  }

  let comparedAt: string | null =
    cp.generated_at || row.created_at || null;
  if (comparedAt) {
    try {
      const d = new Date(comparedAt);
      comparedAt = d.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      // nechaj raw
    }
  }

  return {
    hasData: true,
    comparedAt,
    headline,
    bullets,
    fatigueLabel,
    injuryLabel,
    blockLabel,
    volumeLabel,
  };
}

export default function WidgetCoachProgress({ onOpenDetail }: Props) {
  const { userId } = useUserId();

  const [row, setRow] = useState<AthleteProgressRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetLatestAthleteProgress(userId);
        if (alive) setRow(r ?? null);
      } catch (e: any) {
        if (alive)
          setError(
            e?.message ?? "Chyba pri načítaní AI progress reportu."
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const ui = useMemo(() => buildUiState(row), [row]);

  const accent =
    THEME?.chart?.neutral ??
    THEME?.chart?.lineSecondary ??
    THEME?.chart?.run ??
    "#3B82F6";

  return (
    <WidgetCard
      title="Coach — Weekly progress"
      note={
        ui.hasData
          ? ui.comparedAt
            ? `Posledné porovnanie: ${ui.comparedAt}`
            : "Posledné porovnanie AI stavov atleta."
          : "Potrebujeme aspoň dve AI analýzy stavu – potom sa tu zobrazí progress."
      }
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={190}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-300">
          Nepodarilo sa načítať progress report.
          <div className="mt-1 text-xs opacity-70">{error}</div>
        </div>
      ) : !userId ? (
        <div className="text-sm opacity-80">
          Chýba userId (useUserId). Skontroluj autentifikáciu.
        </div>
      ) : !ui.hasData ? (
        <div className="text-sm opacity-80">
          Zatiaľ nemáš uložené žiadne AI porovnanie stavov. Po dvoch
          analyzovaných týždňoch sa tu zobrazí prehľad progresu.
        </div>
      ) : (
        <>
          {ui.headline && (
            <div className="text-sm font-medium mb-1">{ui.headline}</div>
          )}

          {ui.bullets && ui.bullets.length > 0 && (
            <ul className="text-xs space-y-1 mb-3">
              {ui.bullets.slice(0, 3).map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span className="truncate">{b}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div className="opacity-70">Únava</div>
            <div className="font-semibold">{ui.fatigueLabel ?? "—"}</div>

            <div className="opacity-70">Riziko zranenia</div>
            <div className="font-semibold">{ui.injuryLabel ?? "—"}</div>

            <div className="opacity-70">Blok</div>
            <div className="font-semibold">{ui.blockLabel ?? "—"}</div>

            <div className="opacity-70">Min. týždenný objem</div>
            <div className="font-semibold">{ui.volumeLabel ?? "—"}</div>
          </div>
        </>
      )}
    </WidgetCard>
  );
}