// src/shared/components/widgets/WidgetVO2Max.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Pill from "@/app/shared/ui/components/Pill";
import { useUserId } from "@/app/shared/hooks/useUserId";
import vo2Ref from "@/app/data/VO2Max_Ref_RunnersWorld.json";
import { fmtDate } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  NO_X_OVERFLOW,
  WIDGET_LOADING_CENTER,
  WIDGET_META_LABEL,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_MAIN,
  WIDGET_PLACEHOLDER,
} from "@/app/shared/ui/tokens";

import type {
  HistoryRow,
  EstRow,
  Group,
  Range,
} from "@/app/features/profile/types/profile";
import { levelColor } from "@/app/features/profile/utils/profile";
import {
  apiGetVo2History,
  apiGetVo2Estimate,
} from "@/app/features/profile/api/metrics";

type Props = { onOpen?: () => void; onOpenDetail?: () => void };

const TOOLTIP_VO2MAX = [
  "VO₂Max je odhad maximálneho množstva kyslíka, ktoré vie tvoje telo využiť pri záťaži.",
  "",
  "Čo hovorí:",
  "• všeobecný ukazovateľ aeróbnej kapacity",
  "• porovnateľný medzi ľuďmi rovnakého veku a pohlavia",
  "",
  "Odhad vs. meranie:",
  "• odhad: vypočítaný z tréningových dát (tempo, HR, výkon)",
  "• meranie: laboratórny test (plynová analýza)",
  "",
  "Ako to používať:",
  "• sleduj trend v čase, nie jedno číslo",
  "• malé výkyvy sú normálne",
  "• výkon v pretekoch je vždy dôležitejší než samotná VO₂Max",
].join("\n");

export default function WidgetVO2Max({ onOpen, onOpenDetail }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const { userId } = useUserId();

  const [loading, setLoading] = React.useState(true);
  const [history, setHistory] = React.useState<HistoryRow[]>([]);
  const [sex, setSex] = React.useState<"M" | "F">("M");
  const [birthDate, setBirthDate] = React.useState<string>("");
  const [est, setEst] = React.useState<EstRow | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const [histRes, estRes] = await Promise.all([
          apiGetVo2History(userId),
          apiGetVo2Estimate(userId),
        ]);
        if (!alive) return;

        setHistory(histRes?.history ?? []);
        setSex(histRes?.sex === "F" ? "F" : "M");
        setBirthDate(histRes?.birth_date || "");
        setEst(estRes ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const measured = history.length ? history[history.length - 1] : null;
  const mVO2 = measured?.VO2Max ?? null;

  let ranges: Range[] = [];
  try {
    const age =
      birthDate ? Math.floor((Date.now() - +new Date(birthDate)) / 3.15e10) : 0;
    const g = (vo2Ref as Group[]).find(
      (x) => x.sex === sex && age >= x.age_min && age <= x.age_max,
    );
    ranges = g?.ranges ?? [];
  } catch {}

  const pickLevel = (v?: number | null) => {
    if (v == null || !Number.isFinite(v)) return null;
    const hit = ranges.find(
      (rr) =>
        (rr.min == null || v >= rr.min) && (rr.max == null || v <= rr.max),
    );
    if (!hit) return null;
    return { label: hit.label.trim(), color: levelColor(hit.label) };
  };

  const estVal = Number.isFinite(est?.value as number)
    ? Number(est?.value)
    : null;

  const levelMeasured = pickLevel(mVO2);
  const levelEstimated = pickLevel(estVal);

  const accent =
    levelMeasured?.color ?? levelEstimated?.color ?? appColors.brandPrimary;

  return (
    <WidgetCard
      title="VO₂Max"
      tooltip={TOOLTIP_VO2MAX}
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent={accent}
      minH={168}
      innerClassName={NO_X_OVERFLOW}
    >
      {loading ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-6 md:gap-10">
          {/* estimated */}
          <div>
            <div className={WIDGET_META_LABEL}>
              odhad: {fmtDate(est?.updated_at ?? null)}
            </div>
            <div className={WIDGET_VALUE_ROW}>
              <div className={WIDGET_VALUE_MAIN}>
                {estVal != null ? estVal.toFixed(1) : "—"}
              </div>
              {levelEstimated ? (
                <Pill
                  label={levelEstimated.label}
                  color={levelEstimated.color}
                />
              ) : (
                <span className={WIDGET_PLACEHOLDER}>—</span>
              )}
            </div>
          </div>

          <div
            className="hidden md:block w-px"
            style={{ background: appColors.surfaceCardBorder, opacity: 0.6 }}
          />

          {/* measured */}
          <div>
            <div className={WIDGET_META_LABEL}>
              merané: {fmtDate(measured?.updated_at ?? null)}
            </div>
            <div className={WIDGET_VALUE_ROW}>
              <div className={WIDGET_VALUE_MAIN}>
                {mVO2 != null ? mVO2.toFixed(1) : "—"}
              </div>
              {levelMeasured ? (
                <Pill label={levelMeasured.label} color={levelMeasured.color} />
              ) : (
                <span className={WIDGET_PLACEHOLDER}>—</span>
              )}
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}