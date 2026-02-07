"use client";

import { useEffect, useMemo, useState } from "react";

import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { useUserId } from "@/app/shared/hooks/useUserId";

import {
  apiGetDailyOverview,
  apiSaveDailyReschedule,
  type DailyOverview,
  type DailyPlanDay,
  type DailyRescheduleMove,
} from "@/app/features/coach/api/coach_plan_daily";

import SessionCard, {
  type KPI,
  type PlanSession,
} from "@/app/shared/components/session/SessionCard";

import {
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
} from "@/app/shared/ui/tokens/sessionCard";

/* ---------- helpers ---------- */

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDate(value: string | null | undefined): string | null {
  const d = toDate(value);
  if (!d) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function weekdayLabel(value: string | null | undefined): string | null {
  const d = toDate(value);
  if (!d) return null;
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function sortDaysByDate(days: DailyPlanDay[]): DailyPlanDay[] {
  const copy = [...(days || [])];
  copy.sort((a, b) => {
    const da = a?.date || "";
    const db = b?.date || "";
    return da.localeCompare(db);
  });
  return copy;
}

/* ---------- tiny Card wrapper (token-first) ---------- */

function Card({
  title,
  subtitle,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
      {(title || subtitle) && (
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0">
            {title ? <div className={PANEL_SECTION_TITLE}>{title}</div> : null}
            {subtitle ? (
              <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div>
            ) : null}
          </div>
        </header>
      )}

      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>{children}</div>

      <div className={ACCORDION_FOOTER_BAR_MUTED} />
    </section>
  );
}

/* ---------- main ---------- */

export default function DetailDailyPlan() {
  const { userId } = useUserId();

  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ✅ pending reschedule ops
  const [moves, setMoves] = useState<DailyRescheduleMove[]>([]);

  useEffect(() => {
    if (!userId) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetDailyOverview(userId);
        if (alive) {
          setOverview(r ?? null);
          setMoves([]); // reset dirty when reloading
          setSaveError(null);
        }
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Chyba pri načítaní AI daily plánu.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const days = overview?.days ?? [];
  const hasPlan = days.length > 0;

  const planDates = useMemo(() => {
    const h = overview?.horizon_days ?? 7;
    const out: string[] = [];
    const base = new Date(); // today
    for (let i = 0; i <= h; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [overview?.horizon_days]);
  
  const dayCounts = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const d of days) {
      if (!d.date) continue;
      out[d.date] = d.sessions?.length ?? 0;
    }
    return out;
  }, [days]);

  const dirty = moves.length > 0;

  // ✅ local move by DB PK (id)
  const moveSessionLocal = (
    fromDate: string,
    toDate: string,
    sessionId: number,
  ) => {
    setOverview((prev) => {
      if (!prev) return prev;

      let moved: any = null;

      const daysNext: DailyPlanDay[] = prev.days.map((d) => {
        if (d.date === fromDate) {
          const next = [...(d.sessions ?? [])];
          const i = next.findIndex(
            (x: any) => Number(x?.id) === Number(sessionId),
          );
          if (i >= 0) {
            moved = next[i];
            next.splice(i, 1);
          }
          return { ...d, sessions: next };
        }
        return d;
      });

      if (!moved) return prev;

      const daysNext2: DailyPlanDay[] = daysNext.map((d) => {
        if (d.date === toDate) {
          // dôležité: update plan_date aj lokálne (kvôli UI)
          const moved2 = { ...moved, plan_date: toDate };
          return { ...d, sessions: [...(d.sessions ?? []), moved2] };
        }
        return d;
      });

      return { ...prev, days: daysNext2 };
    });
  };

  const addMove = (m: DailyRescheduleMove) => {
    setMoves((prev) => [...prev, m]);
  };

  const undoLast = () => {
    setMoves((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];

      // revert locally
      moveSessionLocal(last.to_date, last.from_date, Number(last.id));

      return prev.slice(0, -1);
    });
  };

  const saveMoves = async () => {
    if (!userId || !dirty || saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      const next = await apiSaveDailyReschedule(userId, moves);
      if (next) {
        setOverview(next);
      }
      setMoves([]);
    } catch (e: any) {
      setSaveError(e?.message ?? "Nepodarilo sa uložiť zmeny plánu.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- states ---------- */

  if (!userId) {
    return (
      <Card title="AI Daily plan" subtitle="Chýba userId (useUserId).">
        <div className={PANEL_PREVIEW}>Skontroluj prihlásenie používateľa.</div>
      </Card>
    );
  }

  if (loading) {
    return (
      <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
        <div className={[PANEL_PAD, "flex items-center gap-2"].join(" ")}>
          <LoadingSpinner size="button" />
          <div className={PANEL_PREVIEW}>Načítavam tvoj AI daily plán…</div>
        </div>
        <div className={ACCORDION_FOOTER_BAR_MUTED} />
      </section>
    );
  }

  if (error) {
    return (
      <Card title="AI Daily plan" subtitle="Nepodarilo sa načítať plán.">
        <div className={PANEL_PREVIEW}>{error}</div>
      </Card>
    );
  }

  /* ---------- UI ---------- */

  return (
    <div className={PANEL_STACK}>
      <Card
        title="AI Daily plan – detail"
      >
        {!hasPlan ? (
          <div className={PANEL_PREVIEW}>
            Zatiaľ nemáš žiadny aktívny tréningový plán pre jednotlivé dni.
          </div>
        ) : (
          <div className={PANEL_PREVIEW}>
            Presúvanie dňa je možné priamo v karte tréningu avšak narušíš trénerov plán.
          </div>
        )}
      </Card>

      <Card
        title="Denný rozpis tréningov"
        subtitle="Každá karta je jeden tréning. Môžeš zmeniť deň v rámci existujúceho plánu."
      >
        {/* ✅ Save bar */}
        {hasPlan ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs opacity-70">
                {dirty ? `Neuložené zmeny: ${moves.length}` : "Zmeny uložené"}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={!dirty || saving}
                  onClick={async () => {
                    if (!dirty) return;
                    const ok = await confirm({
                      title: "Vrátiť poslednú zmenu?",
                      message: "Táto akcia vráti posledný presun v pláne.",
                      okText: "Vrátiť",
                      cancelText: "Zrušiť",
                      tone: "danger",
                    });
                    if (ok) undoLast();
                  }}
                >
                  Undo
                </Button>

                <Button
                  size="xs"
                  variant="primary"
                  disabled={!dirty || saving}
                  onClick={saveMoves}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>

            {saveError ? (
              <div className="mt-1 text-[11px] text-red-300">{saveError}</div>
            ) : null}
          </div>
        ) : null}

        {!hasPlan ? (
          <div className={PANEL_PREVIEW}>—</div>
        ) : (
          <div className={PANEL_STACK}>
            {days.flatMap((d) => {
              if (!d.date) return [];
              if (!d.sessions || d.sessions.length === 0) return [];

              const dateIso = d.date;
              const dateLabel = formatDate(d.date) ?? d.date;
              const wd = weekdayLabel(d.date) ?? "";

              return d.sessions.map((s: any, idx: number) => {
                const kpis: KPI[] = [];
                if (s.duration_min)
                  kpis.push({
                    label: "DURATION",
                    value: `${s.duration_min} min`,
                  });
                if (s.intensity)
                  kpis.push({ label: "INTENSITY", value: String(s.intensity) });
                if (s.zone_text)
                  kpis.push({ label: "TARGET", value: String(s.zone_text) });

                const item: PlanSession = {
                  // ✅ DB PK (stable). Fallback je len pre UI, save bez PK nedáva zmysel.
                  id: s.id,

                  kind: "plan",
                  status: "planned",
                  title: s.title || s.session_type || s.sport || "Tréning",
                  dateIso,
                  sport: s.sport || "other",
                  subtitle: `${dateLabel}${wd ? ` · ${wd.toUpperCase()}` : ""}`,
                  kpis,
                  notes: s.notes ?? null,

                  planDur: s.duration_min ? `${s.duration_min} min` : null,
                  planIntensity: s.intensity ?? null,
                  planTarget: s.zone_text ?? null,
                  planNotes: s.notes ?? null,

                  planRaw: s,
                  planStructure: s.structure ?? null,
                  planExercises:
                    (s.structure?.strength_exercises as any[]) ?? [],
                };

                return (
                  <SessionCard
                    key={item.id}
                    variant="calendar"
                    item={item}
                    planReschedule={{
                      enabled: true,
                      dates: planDates,
                      dayCounts,
                      maxPerDay: 2,
                      onChangeDate: ({ sessionId, fromDate, toDate }) => {
                        // ✅ hard requirement pre SAVE: musíme mať DB PK
                        if (sessionId == null) return;

                        addMove({
                          id: sessionId,
                          from_date: fromDate,
                          to_date: toDate,
                        });

                        moveSessionLocal(fromDate, toDate, Number(sessionId));
                      },
                    }}
                  />
                );
              });
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
