// src/app/features/activities/components/DetailActivitiesWrapped.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetActivitiesWrappedStatus,
  apiGenerateActivitiesWrapped,
  type ActivitiesWrappedStatus,
  type ActivitiesWrappedSummary,
  type ActivitiesWrappedSport,
} from "@/app/features/activities/api/activities_wrapped";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  PANEL_SURFACE,
  PANEL_SURFACE_STYLE,
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  ACCORDION_FOOTER_BAR_MUTED,
  SESSION_SUBCARD,
  SESSION_SUBCARD_STYLE,
} from "@/app/shared/ui/tokens";

/* ---------- building blocks ---------- */

function Card({
  title,
  subtitle,
  topRight,
  children,
  footer = true,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  topRight?: React.ReactNode;
  children?: React.ReactNode;
  footer?: boolean;
}) {
  return (
    <section className={PANEL_SURFACE} style={PANEL_SURFACE_STYLE}>
      {(title || subtitle || topRight) && (
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0 flex-1">
            {title && <div className={PANEL_SECTION_TITLE}>{title}</div>}
            {subtitle && (
              <div className={[PANEL_SECTION_SUBTITLE, "text-pretty"].join(" ")}>
                {subtitle}
              </div>
            )}
          </div>
          {topRight && (
            <div className="flex flex-wrap justify-end gap-2">{topRight}</div>
          )}
        </header>
      )}
      {children && (
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
          {children}
        </div>
      )}
      {footer && <div className={ACCORDION_FOOTER_BAR_MUTED} />}
    </section>
  );
}

function Subcard({
  title,
  value,
  children,
}: {
  title: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className={[SESSION_SUBCARD, "min-w-0 w-full"].join(" ")} style={SESSION_SUBCARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className="flex flex-wrap justify-between items-baseline gap-2">
          <div className={[PANEL_SECTION_SUBTITLE, "whitespace-nowrap"].join(" ")}>
            {title}
          </div>
          {value != null && (
            <div className={PANEL_SECTION_TITLE} style={{ fontSize: "0.9rem" }}>
              {value}
            </div>
          )}
        </div>
        {children && <div className={PANEL_INNER_STACK}>{children}</div>}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("sk-SK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatMinutes(min: number | null): string {
  if (!min || min <= 0) return "—";
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return `${Math.round(min)} min`;
}

function formatPaceSPerKm(s: number | null): string {
  if (!s || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")} /km`;
}

// 🌟 Športy kde dáva zmysel rýchlosť (km/h) namiesto tempa (min/km) — najmä
// bicykel. Prepočítané z existujúceho avg_pace_s_per_km (sekundy na km),
// keďže to je v rámci JEDNÉHO športu (nie miešané naprieč viacerými), takže
// prepočet je matematicky v poriadku - backend meniť netreba.
const SPEED_SPORTS = new Set(["ride", "bike", "cycling"]);

function formatPaceOrSpeed(sport: string, paceSPerKm: number | null): string {
  if (!paceSPerKm || paceSPerKm <= 0) return "—";
  if (SPEED_SPORTS.has(sport)) {
    const kmh = 3600 / paceSPerKm;
    return `${kmh.toFixed(1)} km/h`;
  }
  return formatPaceSPerKm(paceSPerKm);
}

const SPORT_LABEL: Record<string, string> = {
  run: "Beh",
  ride: "Bicykel",
  swim: "Plávanie",
  strength: "Posilňovanie",
  other: "Iné",
};

const SPORT_ICON: Record<string, string> = {
  run: "🏃",
  ride: "🚴",
  swim: "🏊",
  strength: "🏋️",
  other: "⚡",
};

/* ---------- per-šport karta ---------- */

function SportCard({ sp }: { sp: ActivitiesWrappedSport }) {
  const t = useT();
  const label = SPORT_LABEL[sp.sport] || sp.sport;
  const icon = SPORT_ICON[sp.sport] || "•";

  return (
    <Card
      title={`${icon} ${label}`}
      subtitle={`${sp.count}×`}
    >
      <div className="grid gap-3 md:grid-cols-3 min-w-0">
        {sp.total_distance_km > 0 && (
          <Subcard
            title={t("activitiesWrapped.stats.totalDistance" as any)}
            value={`${sp.total_distance_km} km`}
          />
        )}
        <Subcard
          title={t("activitiesWrapped.stats.totalTime" as any)}
          value={formatMinutes(sp.total_time_min)}
        />
        {sp.total_elevation_m > 0 && (
          <Subcard
            title={t("activitiesWrapped.stats.totalElevation" as any)}
            value={`${sp.total_elevation_m} m`}
          />
        )}
        {/* 🌟 Teraz priamo z backendu - avg_speed_kmh pre bicykel,
            avg_pace_s_per_km pre beh. Žiadny FE prepočet, žiadna
            duplicitná logika, ktorá by sa mohla rozísť s BE. */}
        {sp.avg_speed_kmh != null && (
          <Subcard
            title={t("activitiesWrapped.stats.avgSpeed" as any)}
            value={`${sp.avg_speed_kmh} km/h`}
          />
        )}
        {sp.avg_pace_s_per_km != null && (
          <Subcard
            title={t("activitiesWrapped.stats.avgPace" as any)}
            value={formatPaceSPerKm(sp.avg_pace_s_per_km)}
          />
        )}
        {sp.avg_hr_bpm != null && (
          <Subcard
            title={t("activitiesWrapped.stats.avgHr" as any)}
            value={`${sp.avg_hr_bpm} bpm`}
          />
        )}
      </div>
    </Card>
  );
}

/* ---------- summary detail card ---------- */

function SummaryCard({ s }: { s: ActivitiesWrappedSummary }) {
  const t = useT();
  const hs = s.hard_stats;

  // 🌟 Zoradené podľa total_time_min zostupne - šport s najväčším časom
  // (typicky hlavný šport athléta) ide prvý.
  const sortedBySport = [...(hs.by_sport || [])].sort(
    (a, b) => (b.total_time_min || 0) - (a.total_time_min || 0),
  );

  return (
    <div className={PANEL_STACK}>
      <Card
        title={s.title}
        subtitle={`${formatDate(s.range_start)} — ${formatDate(s.range_end)}`}
      >
        {/*
          🌟 FIX: avg_pace_s_per_km na TOMTO (celkovom, naprieč všetkými
          športmi) leveli sa už nezobrazuje - miešanie behu (min/km) a
          bicykla (km/h) do jedného čísla nedáva zmysel a bolo to zavádzajúce.
          Na tejto úrovni dávajú zmysel len súčty/priemery, ktoré sú medzi
          športmi porovnateľné: počet, vzdialenosť, čas, prevýšenie, HR.
          Pace/rýchlosť sú teraz len na jednotlivých per-šport kartách nižšie.
        */}
        <div className="grid gap-3 md:grid-cols-3 min-w-0">
          <Subcard
            title={t("activitiesWrapped.stats.count" as any)}
            value={hs.count}
          />
          <Subcard
            title={t("activitiesWrapped.stats.totalDistance" as any)}
            value={hs.total_distance_km > 0 ? `${hs.total_distance_km} km` : "—"}
          />
          <Subcard
            title={t("activitiesWrapped.stats.totalTime" as any)}
            value={formatMinutes(hs.total_time_min)}
          />
          <Subcard
            title={t("activitiesWrapped.stats.totalElevation" as any)}
            value={hs.total_elevation_m > 0 ? `${hs.total_elevation_m} m` : "—"}
          />
          {hs.avg_hr_bpm != null && (
            <Subcard
              title={t("activitiesWrapped.stats.avgHr" as any)}
              value={`${hs.avg_hr_bpm} bpm`}
            />
          )}
        </div>
      </Card>

      {/* 🌟 Per-šport karty, každá samostatne, zoradené podľa času */}
      {sortedBySport.map((sp) => (
        <SportCard key={sp.sport} sp={sp} />
      ))}
    </div>
  );
}

/* ---------- main ---------- */

export default function DetailActivitiesWrapped() {
  const { userId } = useUserId() as any;
  const t = useT();

  const [status, setStatus] = useState<ActivitiesWrappedStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiGetActivitiesWrappedStatus(userId);
      setStatus(r);
    } catch (e: any) {
      setError(t(e?.message as any) || t("activitiesWrapped.widget.errorFailedLoad" as any));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const canGenerate = !!status?.can_generate;

  const handleGenerate = useCallback(async () => {
    if (!userId || generating || !canGenerate) return;
    if (!title.trim() || !rangeStart || !rangeEnd) {
      setGenerateError(t("activitiesWrapped.errorInvalidRange" as any));
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await apiGenerateActivitiesWrapped(userId, title.trim(), rangeStart, rangeEnd);
      if (!res?.ok) {
        setGenerateError(
          res?.reason === "no_active_trigger"
            ? t("activitiesWrapped.errorNoActiveTrigger" as any)
            : t("activitiesWrapped.generateError" as any),
        );
        setGenerating(false);
        return;
      }
      setTitle("");
      setRangeStart("");
      setRangeEnd("");
      await loadStatus();
      setGenerating(false);
    } catch (e: any) {
      setGenerateError(t(e?.message as any) || t("activitiesWrapped.generateError" as any));
      setGenerating(false);
    }
  }, [userId, generating, canGenerate, title, rangeStart, rangeEnd, loadStatus, t]);

  if (!userId)
    return (
      <Card
        title={t("activitiesWrapped.title" as any)}
        subtitle={t("common.errors.missingUserAuth" as any)}
      >
        <div className={PANEL_PREVIEW}>{t("common.errors.checkLogin" as any)}</div>
      </Card>
    );

  if (loading)
    return (
      <section className={PANEL_SURFACE} style={PANEL_SURFACE_STYLE}>
        <div className={[PANEL_PAD, "grid place-items-center"].join(" ")}>
          <LoadingSpinner size="widget" />
        </div>
      </section>
    );

  if (error)
    return (
      <Card title={t("activitiesWrapped.title" as any)}>
        <div className={PANEL_PREVIEW} style={{ color: appColors.statusError }}>
          {error}
        </div>
      </Card>
    );

  const history = status?.history ?? [];

  return (
    <div className={PANEL_STACK}>
      {/* FORMULÁR — zablokovaný, ak nie je aktívny trigger */}
      <Card
        title={t("activitiesWrapped.formTitle" as any)}
        subtitle={!canGenerate ? t("activitiesWrapped.lockedNote" as any) : undefined}
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs opacity-70">
            {t("activitiesWrapped.titleLabel" as any)}
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("activitiesWrapped.titlePlaceholder" as any)}
            disabled={!canGenerate || generating}
            className="rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-40"
            style={{
              background: appColors.surfaceSolid,
              border: `1px solid ${appColors.surfaceCardBorder}`,
              color: appColors.textPrimary,
            }}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">
              {t("activitiesWrapped.rangeStartLabel" as any)}
            </span>
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              disabled={!canGenerate || generating}
              className="rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-40"
              style={{
                background: appColors.surfaceSolid,
                border: `1px solid ${appColors.surfaceCardBorder}`,
                color: appColors.textPrimary,
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">
              {t("activitiesWrapped.rangeEndLabel" as any)}
            </span>
            <input
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              disabled={!canGenerate || generating}
              className="rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-40"
              style={{
                background: appColors.surfaceSolid,
                border: `1px solid ${appColors.surfaceCardBorder}`,
                color: appColors.textPrimary,
              }}
            />
          </label>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleGenerate}
          disabled={!canGenerate || generating}
          leftIcon={generating ? <LoadingSpinner size="button" /> : undefined}
        >
          {generating
            ? t("activitiesWrapped.generating" as any)
            : t("activitiesWrapped.generateNow" as any)}
        </Button>

        {generateError && (
          <div
            className={[PANEL_PREVIEW, "text-pretty"].join(" ")}
            style={{ color: appColors.statusError }}
          >
            {generateError}
          </div>
        )}
      </Card>

      {/* HISTÓRIA */}
      <div className="text-xs font-bold uppercase tracking-wider opacity-60 px-1">
        {t("activitiesWrapped.historyTitle" as any)}
      </div>

      {history.length === 0 ? (
        <Card footer={false}>
          <div className={PANEL_PREVIEW}>{t("activitiesWrapped.noHistory" as any)}</div>
        </Card>
      ) : (
        history.map((s) => <SummaryCard key={s.id} s={s} />)
      )}
    </div>
  );
}