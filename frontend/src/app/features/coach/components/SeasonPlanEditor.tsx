// src/app/features/coach/components/SeasonPlanEditor.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { appLocale } from "@/app/shared/i18n/locale";
import Button from "@/app/shared/ui/components/Button";
import DateField from "@/app/shared/ui/components/DateField";
import NumberField from "@/app/shared/ui/components/NumberField";
import TextField from "@/app/shared/ui/components/TextField";
import SegmentedControl from "@/app/shared/ui/components/SegmentedControl";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Pill from "@/app/shared/ui/components/Pill";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { toast } from "@/app/shared/ui/components/Toast";
import { WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import AiUsageWarningBanner from "@/app/features/billing/components/AiUsageWarningBanner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { alpha } from "@/app/shared/ui/theme/colorUtils";
import {
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
} from "@/app/shared/ui/tokens";
import { SESSION_CARD, SESSION_CARD_STYLE } from "@/app/shared/ui/tokens/sessionCard";
import {
  apiDeleteSeasonPlan,
  apiGetSeasonPlan,
  apiSaveSeasonPlan,
  apiSuggestSeasonPlan,
  seasonWeekFor,
  type SeasonPlan,
  type SeasonThreadEntry,
  type SeasonWeek,
  type SeasonWeekLoad,
} from "@/app/features/coach/api/seasonPlan";

const LOADS: SeasonWeekLoad[] = ["recovery", "easy", "moderate", "hard"];
const KNOWN_ERRORS = [
  "ai_quota_exceeded",
  "limit_reached",
  "empty_comment",
  "empty_request",
  "invalid_plan",
  "save_failed",
  "feature_disabled",
  "forbidden",
] as const;

const TEXTAREA =
  "w-full rounded bg-white/5 border border-white/10 p-2.5 text-sm text-white focus:border-white/30 focus:outline-none resize-none placeholder:text-white/20";

function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoLocal(d);
}

/** Pondelok týždňa, do ktorého deň padne – kostra ide po celých týždňoch. */
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return addDays(iso, -((d.getDay() + 6) % 7));
}

/** Počet celých týždňov od pondelka začiatku po týždeň konca (vrátane). */
function weeksBetween(start: string, end: string): number {
  const a = new Date(`${mondayOf(start)}T00:00:00`).getTime();
  const b = new Date(`${mondayOf(end)}T00:00:00`).getTime();
  return Math.round((b - a) / (7 * 86400000)) + 1;
}

const MAX_WEEKS = 16;

/** Najbližší pondelok (dnes, ak je pondelok). */
function nextMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
  return isoLocal(d);
}

export function loadColor(load: SeasonWeekLoad): string {
  if (load === "hard") return appColors.statusWarning;
  if (load === "moderate") return appColors.brandPrimary;
  return appColors.textMuted;
}

export function weekRange(w: SeasonWeek): string {
  const a = new Date(`${w.start_date}T00:00:00`);
  const b = new Date(a);
  b.setDate(a.getDate() + 6);
  const f = (d: Date) => d.toLocaleDateString(appLocale(), { day: "numeric", month: "numeric" });
  return `${f(a)} – ${f(b)}`;
}

function errorCode(e: any): string {
  const code = String(e?.message || "");
  return (KNOWN_ERRORS as readonly string[]).includes(code) ? code : "ai_generation_failed";
}

/** Riadok s počtami týždňa – rovnako v editore aj v karte. */
export function WeekCounts({ w }: { w: SeasonWeek }) {
  const t = useT();
  const parts: string[] = [];
  if (w.run_sessions) {
    parts.push(
      w.run_minutes
        ? fmt(t("seasonPlan.week.runWithMin"), { n: w.run_sessions, min: w.run_minutes })
        : fmt(t("seasonPlan.week.run"), { n: w.run_sessions }),
    );
  }
  if (w.strength_sessions) parts.push(fmt(t("seasonPlan.week.strength"), { n: w.strength_sessions }));
  if (!parts.length) return null;
  return (
    <div className="text-xs" style={{ color: appColors.textMuted }}>
      {parts.join(" · ")}
    </div>
  );
}

function WeekCard({
  w,
  current,
  readOnly,
  onChange,
}: {
  w: SeasonWeek;
  current: boolean;
  readOnly: boolean;
  onChange: (patch: Partial<SeasonWeek>) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(current);
  const num = (v: number | "") => (v === "" ? null : Number(v));

  return (
    <div
      className="rounded-xl border"
      style={{
        borderColor: current ? alpha(appColors.brandPrimary, 0.6) : "rgba(255,255,255,0.08)",
        background: current ? alpha(appColors.brandPrimary, 0.06) : "transparent",
      }}
    >
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left px-3 py-2.5 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: appColors.textMuted }}>
            {fmt(t("seasonPlan.week.label"), { n: w.index })} · {weekRange(w)}
            {current ? ` · ${t("seasonPlan.week.current")}` : ""}
          </div>
          <div className="text-sm font-semibold mt-0.5">{w.theme}</div>
          <WeekCounts w={w} />
        </div>
        <Pill label={t(`seasonPlan.load.${w.load}` as any)} color={loadColor(w.load)} outline />
      </button>

      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          {readOnly ? (
            <>
              {w.focus ? <p className="text-sm leading-snug">{w.focus}</p> : null}
              {w.key_sessions.length ? (
                <ul className="flex flex-col gap-1">
                  {w.key_sessions.map((k, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="opacity-50">•</span>
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {w.strength_focus ? (
                <p className="text-xs" style={{ color: appColors.textMuted }}>
                  {t("seasonPlan.week.strengthFocus")}: {w.strength_focus}
                </p>
              ) : null}
              {w.notes ? (
                <p className="text-xs italic" style={{ color: appColors.textMuted }}>
                  {w.notes}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <TextField label={t("seasonPlan.week.theme")} value={w.theme} maxLength={120} onChange={(e) => onChange({ theme: e.target.value })} />
              <label className="text-xs" style={{ color: appColors.textMuted }}>
                {t("seasonPlan.week.focus")}
                <textarea className={`${TEXTAREA} mt-1`} rows={2} maxLength={600} value={w.focus ?? ""} onChange={(e) => onChange({ focus: e.target.value || null })} />
              </label>
              <SegmentedControl
                options={LOADS.map((l) => ({ value: l, label: t(`seasonPlan.load.${l}` as any) }))}
                value={w.load}
                onChange={(v) => onChange({ load: v })}
              />
              <div className="grid grid-cols-3 gap-2">
                <NumberField label={t("seasonPlan.week.runSessions")} min={0} max={14} value={w.run_sessions ?? ""} onChange={(v) => onChange({ run_sessions: num(v) })} />
                <NumberField label={t("seasonPlan.week.runMinutes")} min={0} max={3000} step={5} value={w.run_minutes ?? ""} onChange={(v) => onChange({ run_minutes: num(v) })} />
                <NumberField label={t("seasonPlan.week.strengthSessions")} min={0} max={7} value={w.strength_sessions ?? ""} onChange={(v) => onChange({ strength_sessions: num(v) })} />
              </div>
              <TextField
                label={t("seasonPlan.week.strengthFocus")}
                value={w.strength_focus ?? ""}
                maxLength={300}
                onChange={(e) => onChange({ strength_focus: e.target.value || null })}
              />
              <label className="text-xs" style={{ color: appColors.textMuted }}>
                {t("seasonPlan.week.keySessions")}
                <textarea
                  className={`${TEXTAREA} mt-1`}
                  rows={3}
                  value={w.key_sessions.join("\n")}
                  onChange={(e) => onChange({ key_sessions: e.target.value.split("\n").slice(0, 5) })}
                />
              </label>
              <label className="text-xs" style={{ color: appColors.textMuted }}>
                {t("seasonPlan.week.notes")}
                <textarea
                  className={`${TEXTAREA} mt-1`}
                  rows={2}
                  maxLength={600}
                  placeholder={t("seasonPlan.week.notesPlaceholder")}
                  value={w.notes ?? ""}
                  onChange={(e) => onChange({ notes: e.target.value || null })}
                />
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Plán obdobia (advisor): zadanie → AI kostra po týždňoch → úpravy (ručne aj
 * komentárom pre AI) → uloženie. Tréningy po dňoch si user skladá sám, kostru
 * vidí hodnotenie týždňa aj návrh tréningu.
 */
export default function SeasonPlanEditor() {
  const t = useT();
  const { userId, trainerView } = useUserId();
  const readOnly = !!trainerView;

  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<SeasonPlan | null>(null);
  const [draft, setDraft] = useState<SeasonPlan | null>(null);
  const [dirty, setDirty] = useState(false);
  const [creating, setCreating] = useState(false);

  const [request, setRequest] = useState("");
  const [startDate, setStartDate] = useState<string>(nextMonday());
  // koniec = nedeľa 8. týždňa; počet týždňov sa dopočíta
  const [endDate, setEndDate] = useState<string>(() => addDays(nextMonday(), 8 * 7 - 1));
  const weeks = endDate >= startDate ? weeksBetween(startDate, endDate) : 0;
  const weeksOk = weeks >= 1 && weeks <= MAX_WEEKS;

  const [comment, setComment] = useState("");
  const [thread, setThread] = useState<SeasonThreadEntry[]>([]);
  const [reply, setReply] = useState<string | null>(null);
  const [roundsLeft, setRoundsLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    apiGetSeasonPlan(Number(userId))
      .then((p) => {
        if (!alive) return;
        setSaved(p);
        setDraft(p);
      })
      .catch(() => alive && setError("load_failed"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId]);

  const today = isoLocal(new Date());
  const currentIndex = useMemo(() => seasonWeekFor(draft, today)?.index ?? null, [draft, today]);

  const askAi = useCallback(
    async (mode: "new" | "refine") => {
      if (!userId || busy) return;
      const text = (mode === "new" ? request : comment).trim();
      if (!text) return;
      setBusy(true);
      setError(null);
      try {
        const res = await apiSuggestSeasonPlan(Number(userId), {
          start_date: startDate,
          weeks: Math.max(1, Math.min(MAX_WEEKS, weeks)),
          request: text,
          thread: mode === "new" ? [] : thread,
          current_plan: mode === "new" ? null : draft,
        });
        setDraft(res.plan);
        setDirty(true);
        setCreating(false);
        setReply(res.reply_text);
        setRoundsLeft(res.rounds_left);
        setThread((prev) => [
          ...(mode === "new" ? [] : prev),
          { role: "user", text },
          { role: "assistant", reply_text: res.reply_text },
        ]);
        setComment("");
      } catch (e: any) {
        setError(errorCode(e));
      } finally {
        setBusy(false);
      }
    },
    [userId, busy, request, comment, startDate, weeks, thread, draft],
  );

  const save = async () => {
    if (!userId || !draft || saving) return;
    setSaving(true);
    setError(null);
    try {
      const p = await apiSaveSeasonPlan(Number(userId), {
        ...draft,
        weeks: draft.weeks.map((w) => ({ ...w, key_sessions: w.key_sessions.map((k) => k.trim()).filter(Boolean) })),
      });
      setSaved(p);
      setDraft(p);
      setDirty(false);
      toast.success(t("seasonPlan.saved"));
    } catch (e: any) {
      setError(errorCode(e));
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setDraft(saved);
    setDirty(false);
    setReply(null);
    setThread([]);
    setRoundsLeft(null);
    setCreating(false);
  };

  const remove = async () => {
    if (!userId) return;
    const ok = await confirm({
      title: t("seasonPlan.deleteTitle"),
      message: t("seasonPlan.deleteMessage"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
    });
    if (!ok) return;
    try {
      await apiDeleteSeasonPlan(Number(userId));
      setSaved(null);
      setDraft(null);
      setDirty(false);
      setReply(null);
      setThread([]);
      toast.success(t("common.deleted"));
    } catch (e: any) {
      setError(errorCode(e));
    }
  };

  const patchWeek = (idx: number, patch: Partial<SeasonWeek>) => {
    setDraft((d) => (d ? { ...d, weeks: d.weeks.map((w, i) => (i === idx ? { ...w, ...patch } : w)) } : d));
    setDirty(true);
  };

  if (loading) return <WidgetLoading />;

  const showBrief = !readOnly && (!draft || creating);

  const errorBox = error ? (
    <>
      {error === "ai_quota_exceeded" ? <AiUsageWarningBanner forceShow /> : null}
      <p className="text-xs" style={{ color: appColors.statusError }}>
        {t(`seasonPlan.errors.${error}` as any)}
      </p>
    </>
  ) : null;

  return (
    <div className={PANEL_STACK}>
      {showBrief ? (
        <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
          <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
            <div className="min-w-0">
              <div className={PANEL_SECTION_TITLE}>✨ {t("seasonPlan.brief.title")}</div>
              <div className={PANEL_SECTION_SUBTITLE}>{t("seasonPlan.brief.subtitle")}</div>
            </div>
          </header>
          <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
            <textarea
              className={TEXTAREA}
              rows={6}
              maxLength={1500}
              value={request}
              disabled={busy}
              placeholder={t("seasonPlan.brief.placeholder")}
              onChange={(e) => setRequest(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2 items-start">
              <label className="text-xs flex flex-col gap-1" style={{ color: appColors.textMuted }}>
                {t("seasonPlan.brief.start")}
                <DateField
                  value={startDate}
                  onChange={(v) => {
                    if (!v) return;
                    // posun začiatku zachová dĺžku obdobia
                    const len = weeksOk ? weeks : 8;
                    setStartDate(v);
                    setEndDate(addDays(mondayOf(v), len * 7 - 1));
                  }}
                />
              </label>
              <label className="text-xs flex flex-col gap-1" style={{ color: appColors.textMuted }}>
                {t("seasonPlan.brief.end")}
                <DateField value={endDate} min={startDate} onChange={(v) => v && setEndDate(v)} />
              </label>
            </div>
            <p className="text-[11px]" style={{ color: weeksOk ? appColors.textMuted : appColors.statusError }}>
              {weeksOk
                ? `${fmt(t("seasonPlan.brief.weeksCount"), { n: weeks })} · ${t("seasonPlan.brief.hint")}`
                : fmt(t("seasonPlan.brief.weeksInvalid"), { max: MAX_WEEKS })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="primary" disabled={busy || !request.trim() || !weeksOk} onClick={() => askAi("new")}>
                {busy ? <LoadingSpinner size="button" /> : t("seasonPlan.brief.ask")}
              </Button>
              {draft ? (
                <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setCreating(false)}>
                  {t("common.cancel")}
                </Button>
              ) : null}
            </div>
            {errorBox}
          </div>
        </section>
      ) : null}

      {!showBrief && !draft ? (
        <p className="text-sm" style={{ color: appColors.textMuted }}>
          {t("seasonPlan.emptyTrainer")}
        </p>
      ) : null}

      {!showBrief && draft ? (
        <>
          <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
            <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
              <div className="min-w-0 flex-1">
                {readOnly ? (
                  <div className={PANEL_SECTION_TITLE}>{draft.title}</div>
                ) : (
                  <TextField
                    value={draft.title}
                    maxLength={120}
                    onChange={(e) => {
                      setDraft({ ...draft, title: e.target.value });
                      setDirty(true);
                    }}
                  />
                )}
                <div className={`${PANEL_SECTION_SUBTITLE} mt-1`}>
                  {fmt(t("seasonPlan.range"), { n: draft.weeks.length })} · {weekRange(draft.weeks[0]).split(" – ")[0]} –{" "}
                  {weekRange(draft.weeks[draft.weeks.length - 1]).split(" – ")[1]}
                  {dirty ? ` · ${t("seasonPlan.unsaved")}` : ""}
                </div>
              </div>
            </header>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              {draft.goal_summary ? <p className="text-sm leading-relaxed">{draft.goal_summary}</p> : null}
              {draft.principles.length ? (
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold opacity-50 mb-1">
                    {t("seasonPlan.principles")}
                  </div>
                  <ul className="flex flex-col gap-1">
                    {draft.principles.map((p, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-snug">
                        <span className="opacity-50">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {reply ? (
                <div
                  className="rounded-lg px-3 py-2 text-xs leading-relaxed"
                  style={{ border: `1px solid ${alpha(appColors.brandPrimary, 0.35)}`, background: alpha(appColors.brandPrimary, 0.06) }}
                >
                  ✨ {reply}
                </div>
              ) : null}
            </div>
          </section>

          <div className="flex flex-col gap-2">
            {draft.weeks.map((w, i) => (
              <WeekCard
                key={`${w.index}-${w.start_date}`}
                w={w}
                current={w.index === currentIndex}
                readOnly={readOnly}
                onChange={(patch) => patchWeek(i, patch)}
              />
            ))}
          </div>

          {!readOnly ? (
            <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
              <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
                <div className="text-sm font-semibold">✨ {t("seasonPlan.refine.title")}</div>
                {roundsLeft === 0 ? (
                  <p className="text-[11px]" style={{ color: appColors.textMuted }}>
                    {t("seasonPlan.refine.noMoreRounds")}
                  </p>
                ) : (
                  <>
                    <textarea
                      className={TEXTAREA}
                      rows={2}
                      maxLength={1500}
                      value={comment}
                      disabled={busy}
                      placeholder={t("seasonPlan.refine.placeholder")}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <Button type="button" size="sm" variant="secondary" className="self-start" disabled={busy || !comment.trim()} onClick={() => askAi("refine")}>
                      {busy ? (
                        <LoadingSpinner size="button" />
                      ) : roundsLeft != null ? (
                        fmt(t("seasonPlan.refine.askLeft"), { n: roundsLeft })
                      ) : (
                        t("seasonPlan.refine.ask")
                      )}
                    </Button>
                  </>
                )}
                {errorBox}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                  <Button type="button" size="sm" variant="primary" disabled={!dirty || saving} onClick={save}>
                    {saving ? <LoadingSpinner size="button" /> : t("seasonPlan.save")}
                  </Button>
                  {dirty && saved ? (
                    <Button type="button" size="sm" variant="secondary" onClick={discard}>
                      {t("seasonPlan.discard")}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRequest(draft.request ?? "");
                      setCreating(true);
                    }}
                  >
                    {t("seasonPlan.newPlan")}
                  </Button>
                  {saved ? (
                    <Button type="button" size="sm" variant="secondary" className="ml-auto" onClick={remove} style={{ color: appColors.statusError }}>
                      {t("seasonPlan.delete")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
