// src/app/shared/components/session/ActivityCoachReviewSection.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";

import {
  apiEnqueueActivityReview,
  apiGetActivityReview,
} from "@/app/features/activities/api/activity_review";

import type { ActivitySession } from "./SessionCard";

// berieme shell priamo z ActivitySessionDetail – nič nové nevymýšľame
import { ActivitySectionShell } from "./ActivitySessionDetail";

/* ================= helpers ================= */

type Props = {
  item: ActivitySession;
  activityId: number;
};

type ReviewSection = { title: string; text: string };

function joinLines(lines: string[]): string {
  return lines.filter(Boolean).join("\n");
}

function bulletize(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => {
      if (x == null) return null;
      if (typeof x === "string") return `• ${x}`;
      if (typeof x === "object" && typeof x.text === "string") return `• ${x.text}`;
      return `• ${String(x)}`;
    })
    .filter(Boolean) as string[];
}

// Safari-safe parser: zvládne ISO aj "YYYY-MM-DD HH:MM:SS+00" aj "+0000" aj bez TZ
function parseDateSafe(v: any): Date | null {
  if (!v) return null;
  const raw = String(v).trim();

  // 1) už ISO (alebo niečo čo JS zvládne)
  let d = new Date(raw);
  if (Number.isFinite(d.getTime())) return d;

  // 2) "YYYY-MM-DD HH:MM:SS+00" alebo "+0000" alebo "+00:00"
  // -> "YYYY-MM-DDTHH:MM:SS+00:00"
  const m = raw.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?([+-]\d{2})(?::?(\d{2}))?$/,
  );
  if (m) {
    const date = m[1];
    const time = m[2];
    const tzH = m[3];
    const tzM = m[4] ?? "00";
    const iso = `${date}T${time}${tzH}:${tzM}`;
    d = new Date(iso);
    if (Number.isFinite(d.getTime())) return d;
  }

  // 3) "YYYY-MM-DD HH:MM:SS" bez TZ -> ber ako local
  const m2 = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  if (m2) {
    d = new Date(`${m2[1]}T${m2[2]}`);
    if (Number.isFinite(d.getTime())) return d;
  }

  return null;
}

function formatUpdatedAt(v: any): string | null {
  const d = parseDateSafe(v);
  if (!d) return null;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSectionsFromReview(review: any): ReviewSection[] {
  if (!review) return [];

  // keď BE vráti string
  if (typeof review === "string") {
    const t = String(review).trim();
    return t ? [{ title: "Coach komentár", text: t }] : [];
  }

  if (typeof review !== "object") {
    return [{ title: "Coach komentár", text: String(review) }];
  }

  const sections: ReviewSection[] = [];

  // Zhrnutie
  const headline = review?.summary?.headline;
  const bullets = bulletize(review?.summary?.bullets);
  const summaryText = joinLines([
    headline ? String(headline).trim() : "",
    bullets.length ? "" : "",
    ...bullets,
  ]).trim();
  if (summaryText) sections.push({ title: "Zhrnutie", text: summaryText });

  // Intenzita
  const dom = review?.intensity?.dominant_zone ? String(review.intensity.dominant_zone) : null;
  const notes = review?.intensity?.notes ? String(review.intensity.notes) : null;
  const zm = review?.intensity?.z_minutes;

  const zLines =
    zm && typeof zm === "object"
      ? [
          `Z1: ${Number(zm.z1 ?? 0)} min`,
          `Z2: ${Number(zm.z2 ?? 0)} min`,
          `Z3: ${Number(zm.z3 ?? 0)} min`,
          `Z4: ${Number(zm.z4 ?? 0)} min`,
          `Z5: ${Number(zm.z5 ?? 0)} min`,
        ]
      : [];

  const intensityText = joinLines(
    [
      dom ? `Dominantná zóna: ${dom}` : "",
      notes ? notes : "",
      zLines.length ? "" : "",
      ...(zLines.length ? zLines.map((x) => `• ${x}`) : []),
    ].filter(Boolean),
  ).trim();
  if (intensityText) sections.push({ title: "Intenzita", text: intensityText });

  // Skóre
  const exec = review?.execution_score_0_to_100;
  const effort = review?.effort_rating_1_to_10;
  const scoreLines: string[] = [];
  if (Number.isFinite(Number(exec))) scoreLines.push(`• Execution score: ${Number(exec)}/100`);
  if (Number.isFinite(Number(effort))) scoreLines.push(`• Effort: ${Number(effort)}/10`);
  if (scoreLines.length) sections.push({ title: "Skóre", text: joinLines(scoreLines) });

  // What went well / improve
  const well = bulletize(review?.what_went_well);
  if (well.length) sections.push({ title: "Čo bolo dobré", text: joinLines(well) });

  const improve = bulletize(review?.what_to_improve);
  if (improve.length) sections.push({ title: "Čo zlepšiť", text: joinLines(improve) });

  // Highlights
  const hi = bulletize(review?.highlights);
  if (hi.length) sections.push({ title: "Highlights", text: joinLines(hi) });

  // Next steps
  const ns = Array.isArray(review?.next_steps) ? review.next_steps : [];
  const nsLines = ns
    .map((x: any) => {
      if (!x) return null;
      const t = typeof x.text === "string" ? x.text.trim() : "";
      const ty = typeof x.type === "string" ? x.type.trim() : "";
      if (!t) return null;
      return ty ? `• (${ty}) ${t}` : `• ${t}`;
    })
    .filter(Boolean) as string[];
  if (nsLines.length) sections.push({ title: "Ďalšie kroky", text: joinLines(nsLines) });

  // Risks
  const risks = bulletize(review?.risks);
  if (risks.length) sections.push({ title: "Riziká", text: joinLines(risks) });

  // fallback (keby prišiel iný schema)
  if (sections.length === 0) {
    try {
      sections.push({ title: "Detail", text: JSON.stringify(review, null, 2) });
    } catch {
      sections.push({ title: "Detail", text: String(review) });
    }
  }

  return sections;
}

/* ================= component ================= */

export default function ActivityCoachReviewSection({ item, activityId }: Props) {
  const { userId } = useUserId();

  const activityData: any = useActivityData() as any;
  const { getSummary } = activityData;

  const s: any | null = activityId != null ? (getSummary(activityId) as any) || null : null;

  // pre 7-dňové okno – ber čo máme
  const startDt =
    parseDateSafe(s?.start_date_local) ||
    parseDateSafe(s?.start_date) ||
    parseDateSafe((item as any)?.startDate) ||
    null;

  const isEligible = useMemo(() => {
    // keď nevieme dátum -> radšej ZAKÁŽ (inak to pôsobí bugovo)
    if (!startDt) return false;
    const days = (Date.now() - startDt.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  }, [startDt]);

  const [review, setReview] = useState<any | null>(null);
  const [reviewUpdatedAt, setReviewUpdatedAt] = useState<string | null>(null);

  const [busyLoad, setBusyLoad] = useState(false);
  const [busyGen, setBusyGen] = useState(false);

  const reload = async () => {
    if (!userId || !activityId) return;
    setBusyLoad(true);
    try {
      const out = await apiGetActivityReview(Number(userId), Number(activityId));
      const r = out?.review ?? null;
      setReview(r);
      setReviewUpdatedAt(formatUpdatedAt(out?.updated_at) ?? null);
    } catch (e) {
      console.error("[ActivityCoachReviewSection] load error", e);
      setReview(null);
      setReviewUpdatedAt(null);
    } finally {
      setBusyLoad(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activityId]);

  const sections = useMemo(() => buildSectionsFromReview(review), [review]);
  const hasReview = sections.length > 0;

  const defaultOpen = hasReview;

  // CTA text do collapsed stavu
  let note: ReactNode = null;
  if (!hasReview) {
    if (!startDt) {
      note = <div className="text-xs opacity-70">AI review sa nedá spustiť – chýba dátum aktivity.</div>;
    } else if (!isEligible) {
      note = <div className="text-xs opacity-70">AI review je dostupné len pre aktivity z posledných 7 dní.</div>;
    } else {
      note = <div className="text-xs opacity-70">Môžeš vygenerovať coach komentár k tejto aktivite.</div>;
    }
  }

  const onGenerate = async () => {
    if (!userId || !activityId || busyGen) return;
    setBusyGen(true);
    try {
      await apiEnqueueActivityReview(Number(userId), Number(activityId), {
        runNow: true,
        debug: false,
      });

      // refresh – worker môže dobehnúť o chvíľu
      await reload();
    } catch (e) {
      console.error("[ActivityCoachReviewSection] generate error", e);
      await reload();
    } finally {
      setBusyGen(false);
    }
  };

  const disabledReason =
    !userId
      ? "Missing userId"
      : hasReview
        ? "Review už existuje"
        : !startDt
          ? "Chýba dátum aktivity"
          : !isEligible
            ? "Len pre aktivity z posledných 7 dní"
            : null;

  const actionBtn = (
    <Button
      type="button"
      variant="primary"
      size="sm"
      onClick={onGenerate}
      disabled={!!disabledReason || busyGen}
      title={disabledReason ?? "Generate AI activity review (async job)"}
    >
      {hasReview ? "Reviewed" : busyGen ? "Generating…" : "AI review"}
    </Button>
  );

  return (
    <ActivitySectionShell title="Coach komentár" defaultOpen={defaultOpen} items={[]}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{note}</div>
        <div className="shrink-0">{actionBtn}</div>
      </div>

      <div className="mt-3">
        {busyLoad && <div className="text-xs opacity-70">Loading…</div>}

        {!busyLoad && hasReview && (
          <div className="grid gap-4">
            {sections.map((sec) => (
              <div key={sec.title} className="min-w-0">
                <div className="text-sm font-semibold">{sec.title}</div>
                <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed opacity-90">
                  {sec.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {!busyLoad && !hasReview && (
          <div className="text-sm opacity-80">Zatiaľ bez coach komentára.</div>
        )}

        {reviewUpdatedAt && (
          <div className="mt-3 text-[11px] opacity-60">Update: {reviewUpdatedAt}</div>
        )}
      </div>
    </ActivitySectionShell>
  );
}