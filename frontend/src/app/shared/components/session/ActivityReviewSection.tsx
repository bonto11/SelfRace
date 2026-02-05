"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";

import { apiEnqueueActivityReview, apiGetActivityReview } from "@/app/features/activities/api/activity_review";
import type { ActivitySession } from "./SessionCard";

// berieme shell priamo z ActivitySessionDetail – nič nové nevymýšľame
import { ActivitySectionShell } from "./ActivitySessionDetail"; // ⬅️ viď úprava nižšie (export shell)

type Props = {
  item: ActivitySession;
  activityId: number;
};

function safeText(value: any): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseDateMaybe(v: any): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : null;
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

export default function ActivityCoachReviewSection({ item, activityId }: Props) {
  const { userId } = useUserId();
  const activityData: any = useActivityData() as any;
  const { getSummary } = activityData;

  const s: any | null = activityId != null ? (getSummary(activityId) as any) || null : null;

  // pre 7-dňové okno – ber čo máme
  const startDt =
    parseDateMaybe(s?.start_date_local) ||
    parseDateMaybe(s?.start_date) ||
    parseDateMaybe((item as any)?.startDate) ||
    null;

  const isEligible = useMemo(() => {
    if (!startDt) return true; // keď nemáme dátum, nezakazuj (lepší UX)
    return daysBetween(new Date(), startDt) <= 7;
  }, [startDt]);

  const [review, setReview] = useState<any | null>(null);
  const [reviewMeta, setReviewMeta] = useState<{ updated_at?: string | null } | null>(null);

  const [busyLoad, setBusyLoad] = useState(false);
  const [busyGen, setBusyGen] = useState(false);

  const [openByDefault, setOpenByDefault] = useState(false);

  const reload = async () => {
    if (!userId || !activityId) return;
    setBusyLoad(true);
    try {
      const out = await apiGetActivityReview(Number(userId), Number(activityId));
      const r = out?.review ?? null;
      setReview(r);
      setReviewMeta({ updated_at: out?.updated_at ?? null });
      setOpenByDefault(!!r); // keď existuje review, rozbaľ default
    } catch (e) {
      console.error("[ActivityCoachReviewSection] load error", e);
      setReview(null);
      setReviewMeta(null);
      setOpenByDefault(false);
    } finally {
      setBusyLoad(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activityId]);

  const onGenerate = async () => {
    if (!userId || !activityId || busyGen) return;

    setBusyGen(true);
    try {
      // ⚠️ v produkcii toto MUSÍ byť auth volanie (cookies/jwt). service=true sem nedávaj.
      await apiEnqueueActivityReview(Number(userId), Number(activityId), {
        runNow: true,
        debug: false,
      });

      // po enqueue okamžite refresh – worker môže dobehnúť o chvíľu
      await reload();
    } catch (e) {
      console.error("[ActivityCoachReviewSection] generate error", e);
      await reload();
    } finally {
      setBusyGen(false);
    }
  };

  const hasReview = !!review;

  // CTA text do collapsed stavu
  let note: ReactNode = null;
  if (!hasReview) {
    if (!isEligible) {
      note = <div className="text-xs opacity-70">AI review je dostupné len pre aktivity z posledných 7 dní.</div>;
    } else {
      note = <div className="text-xs opacity-70">Môžeš vygenerovať coach komentár k tejto aktivite.</div>;
    }
  }

  const actionBtn = (
    <Button
      type="button"
      variant="primary"
      size="sm"
      onClick={onGenerate}
      disabled={!userId || busyGen || hasReview || !isEligible}
      title={
        !userId
          ? "Missing userId"
          : hasReview
            ? "Review už existuje"
            : !isEligible
              ? "Len pre aktivity z posledných 7 dní"
              : "Generate AI activity review (async job)"
      }
    >
      {hasReview ? "Reviewed" : busyGen ? "Generating…" : "AI review"}
    </Button>
  );

  return (
    <ActivitySectionShell
      title="Coach komentár"
      defaultOpen={openByDefault}
      items={[]}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{note}</div>
        <div className="shrink-0">{actionBtn}</div>
      </div>

      <div className="mt-2">
        {busyLoad && <div className="text-xs opacity-70">Loading…</div>}

        {!busyLoad && hasReview && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {typeof review === "string" ? review : safeText(review)}
          </div>
        )}

        {!busyLoad && !hasReview && (
          <div className="text-sm opacity-80">Zatiaľ bez coach komentára.</div>
        )}

        {!!reviewMeta?.updated_at && (
          <div className="mt-2 text-[11px] opacity-60">Update: {String(reviewMeta.updated_at)}</div>
        )}
      </div>
    </ActivitySectionShell>
  );
}