// src/shared/components/widgets/WidgetCoachProgress.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_CENTER_SPINNER,
  WIDGET_ERROR_BLOCK,
  WIDGET_ERROR_SUB,
  WIDGET_EMPTY_TEXT,
  WIDGET_HEADLINE,
  WIDGET_BULLET_LIST,
  WIDGET_BULLET_ROW,
  WIDGET_BULLET_DOT,
  WIDGET_INFO_GRID_XS,
  WIDGET_LABEL_MUTED_XS,
  WIDGET_VALUE_STRONG_XS,
} from "@/app/shared/ui/tokens";

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
  const payload: any =
    (row as any)?.report ?? (row as any)?.compare_previous ?? null;

  if (!row || !payload) {
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

  const cp = payload;

  const headline: string | null = cp.summary?.headline || cp.headline || null;

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
    typeof vol.previous_weekly_minutes_min === "number" &&
    typeof vol.current_weekly_minutes_min === "number"
  ) {
    const fromH = Math.round(vol.previous_weekly_minutes_min / 60);
    const toH = Math.round(vol.current_weekly_minutes_min / 60);
    volumeLabel = `${fromH} h → ${toH} h / týždeň (min)`;
  }

  let comparedAt: string | null = cp.generated_at || row.created_at || null;
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
      // keep raw
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
          setError(e?.message ?? "Chyba pri načítaní AI progress reportu.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const ui = useMemo(() => buildUiState(row), [row]);

  return (
    <WidgetCard
      title="Coach — Weekly progress"
      accent="none"
      note={
        ui.hasData
          ? ui.comparedAt
            ? `Posledné porovnanie: ${ui.comparedAt}`
            : "Posledné porovnanie AI stavov atleta."
          : "Potrebujeme aspoň dve AI analýzy stavu – potom sa tu zobrazí progress."
      }
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={190}
    >
      {loading ? (
        <div className={WIDGET_CENTER_SPINNER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className={WIDGET_ERROR_BLOCK}>
          Nepodarilo sa načítať progress report.
          <div className={WIDGET_ERROR_SUB}>{error}</div>
        </div>
      ) : !userId ? (
        <div className={WIDGET_EMPTY_TEXT}>
          Chýba userId (useUserId). Skontroluj autentifikáciu.
        </div>
      ) : !ui.hasData ? (
        <div className={WIDGET_EMPTY_TEXT}>
          Zatiaľ nemáš uložené žiadne AI porovnanie stavov. Po dvoch
          analyzovaných týždňoch sa tu zobrazí prehľad progresu.
        </div>
      ) : (
        <>
          {ui.headline && <div className={WIDGET_HEADLINE}>{ui.headline}</div>}

          {ui.bullets.length > 0 && (
            <ul className={WIDGET_BULLET_LIST}>
              {ui.bullets.slice(0, 3).map((b, i) => (
                <li key={i} className={WIDGET_BULLET_ROW}>
                  <span className={WIDGET_BULLET_DOT} />
                  <span className="truncate">{b}</span>
                </li>
              ))}
            </ul>
          )}

          <div className={WIDGET_INFO_GRID_XS}>
            <div className={WIDGET_LABEL_MUTED_XS}>Únava</div>
            <div className={WIDGET_VALUE_STRONG_XS}>
              {ui.fatigueLabel ?? "—"}
            </div>

            <div className={WIDGET_LABEL_MUTED_XS}>Riziko zranenia</div>
            <div className={WIDGET_VALUE_STRONG_XS}>
              {ui.injuryLabel ?? "—"}
            </div>

            <div className={WIDGET_LABEL_MUTED_XS}>Blok</div>
            <div className={WIDGET_VALUE_STRONG_XS}>{ui.blockLabel ?? "—"}</div>

            <div className={WIDGET_LABEL_MUTED_XS}>Min. týždenný objem</div>
            <div className={WIDGET_VALUE_STRONG_XS}>
              {ui.volumeLabel ?? "—"}
            </div>
          </div>
        </>
      )}
    </WidgetCard>
  );
}
