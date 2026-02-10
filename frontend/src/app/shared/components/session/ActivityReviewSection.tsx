// src/app/shared/components/session/ActivityReviewSection.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";

import {
  apiGetActivityReview,
  apiRerunActivityReview, // ✅ správny import
} from "@/app/features/activities/api/activity_review";

import {
  getSubscriptionTier,
  subscribeSubscriptionTier,
} from "@/app/shared/state/subscriptionTierStore";

import type { ActivitySession } from "./SessionCard";
import { ActivitySectionShell } from "./ActivitySessionDetail";

/* ================= helpers ================= */

type Props = {
  item: ActivitySession;
  activityId: number;
};

type ReviewSection = { title: string; text: string };

const MAX_COMMENT_CHARS = 900;

function joinLines(lines: string[]): string {
  return lines.filter(Boolean).join("\n");
}

function bulletize(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => {
      if (x == null) return null;
      if (typeof x === "string") return `• ${x}`;
      if (typeof x === "object" && typeof x.text === "string")
        return `• ${x.text}`;
      return `• ${String(x)}`;
    })
    .filter(Boolean) as string[];
}

// Safari-safe parser: ISO + "YYYY-MM-DD HH:MM:SS+00" + "YYYY-MM-DD" (Supabase date)
function parseDateSafe(v: any): Date | null {
  if (!v) return null;
  const raw = String(v).trim();

  const d0 = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d0) {
    const y = Number(d0[1]);
    const m = Number(d0[2]);
    const d = Number(d0[3]);
    const out = new Date(y, m - 1, d, 0, 0, 0, 0);
    return Number.isFinite(out.getTime()) ? out : null;
  }

  let d = new Date(raw);
  if (Number.isFinite(d.getTime())) return d;

  const m1 = raw.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?([+-]\d{2})(?::?(\d{2}))?$/,
  );
  if (m1) {
    const date = m1[1];
    const time = m1[2];
    const tzH = m1[3];
    const tzM = m1[4] ?? "00";
    const iso = `${date}T${time}${tzH}:${tzM}`;
    d = new Date(iso);
    if (Number.isFinite(d.getTime())) return d;
  }

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

  if (typeof review === "string") {
    const t = String(review).trim();
    return t ? [{ title: "Coach komentár", text: t }] : [];
  }

  if (typeof review !== "object") {
    return [{ title: "Coach komentár", text: String(review) }];
  }

  const sections: ReviewSection[] = [];

  const headline = review?.summary?.headline;
  const bullets = bulletize(review?.summary?.bullets);
  const summaryText = joinLines([
    headline ? String(headline).trim() : "",
    bullets.length ? "" : "",
    ...bullets,
  ]).trim();
  if (summaryText) sections.push({ title: "Zhrnutie", text: summaryText });

  const dom = review?.intensity?.dominant_zone
    ? String(review.intensity.dominant_zone)
    : null;
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

  const exec = review?.execution_score_0_to_100;
  const effort = review?.effort_rating_1_to_10;
  const scoreLines: string[] = [];
  if (Number.isFinite(Number(exec)))
    scoreLines.push(`• Execution score: ${Number(exec)}/100`);
  if (Number.isFinite(Number(effort)))
    scoreLines.push(`• Effort: ${Number(effort)}/10`);
  if (scoreLines.length)
    sections.push({ title: "Skóre", text: joinLines(scoreLines) });

  const well = bulletize(review?.what_went_well);
  if (well.length)
    sections.push({ title: "Čo bolo dobré", text: joinLines(well) });

  const improve = bulletize(review?.what_to_improve);
  if (improve.length)
    sections.push({ title: "Čo zlepšiť", text: joinLines(improve) });

  const hi = bulletize(review?.highlights);
  if (hi.length) sections.push({ title: "Highlights", text: joinLines(hi) });

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
  if (nsLines.length)
    sections.push({ title: "Ďalšie kroky", text: joinLines(nsLines) });

  const risks = bulletize(review?.risks);
  if (risks.length) sections.push({ title: "Riziká", text: joinLines(risks) });

  if (sections.length === 0) {
    try {
      sections.push({ title: "Detail", text: JSON.stringify(review, null, 2) });
    } catch {
      sections.push({ title: "Detail", text: String(review) });
    }
  }

  return sections;
}

function getTierCodeFromInit(activityData: any): string {
  const v =
    activityData?.init?.user?.app_subscription_tier ??
    activityData?.init?.app?.tier_code ??
    activityData?.init?.tier_code ??
    activityData?.athlete_state?.tier ??
    activityData?.athleteState?.tier ??
    activityData?.user?.app_subscription_tier ??
    "free";
  return String(v || "free").toLowerCase();
}

function maxVersionsForTier(tier: string): number {
  if (tier === "pro") return 3;
  if (tier === "classic") return 2;
  return 1; // free
}

/* ================= component ================= */

export default function ActivityCoachReviewSection({ item, activityId }: Props) {
  const { userId } = useUserId();

  const activityData: any = useActivityData() as any;
  const { getSummary } = activityData;

  // ✅ tier: store je primár, init je fallback
  const [tierCode, setTierCode] = useState<string>(() => {
    const t = (getSubscriptionTier() || "").toLowerCase();
    return t || getTierCodeFromInit(activityData) || "free";
  });

  useEffect(() => {
    const initTier = getTierCodeFromInit(activityData);
    if (
      initTier &&
      initTier !== "free" &&
      (getSubscriptionTier() || "free").toLowerCase() === "free"
    ) {
      setTierCode(initTier.toLowerCase());
    }

    return subscribeSubscriptionTier((t) => {
      setTierCode(String(t || "free").toLowerCase());
    });
  }, [activityData]);

  const maxVersions = useMemo(() => maxVersionsForTier(tierCode), [tierCode]);

  const s: any | null =
    activityId != null ? (getSummary(activityId) as any) || null : null;

  const startDt = parseDateSafe(s?.date) || null;

  const isEligible = useMemo(() => {
    if (!startDt) return false;
    const days = (Date.now() - startDt.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  }, [startDt]);

  const [review, setReview] = useState<any | null>(null);
  const [reviewUpdatedAt, setReviewUpdatedAt] = useState<string | null>(null);

  // meta from DB
  const [aiReviewVersion, setAiReviewVersion] = useState<number>(1);
  const [aiReviewLastSource, setAiReviewLastSource] = useState<string | null>(
    null,
  );
  const [aiReviewLastUserCommentAt, setAiReviewLastUserCommentAt] = useState<
    string | null
  >(null);

  // user input
  const [comment, setComment] = useState<string>("");
  const commentLen = comment.length;
  const commentTooLong = commentLen > MAX_COMMENT_CHARS;

  const [busyLoad, setBusyLoad] = useState(false);
  const [busyGen, setBusyGen] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const reload = async () => {
    if (!userId || !activityId) return;
    setBusyLoad(true);
    try {
      const out = await apiGetActivityReview(Number(userId), Number(activityId));

      const r = out?.review ?? null;
      setReview(r);
      setReviewUpdatedAt(formatUpdatedAt(out?.updated_at) ?? null);

      const v = Number((out as any)?.ai_review_version ?? 1);
      setAiReviewVersion(Number.isFinite(v) && v > 0 ? v : 1);

      setAiReviewLastSource(
        typeof (out as any)?.ai_review_last_source === "string"
          ? String((out as any).ai_review_last_source)
          : null,
      );

      setAiReviewLastUserCommentAt(
        typeof (out as any)?.ai_review_last_user_comment_at === "string"
          ? formatUpdatedAt((out as any).ai_review_last_user_comment_at)
          : null,
      );
    } catch (e) {
      console.error("[ActivityCoachReviewSection] load error", e);
      setReview(null);
      setReviewUpdatedAt(null);
      setAiReviewVersion(1);
      setAiReviewLastSource(null);
      setAiReviewLastUserCommentAt(null);
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

  const canRerunByTier = maxVersions > 1; // classic/pro
  const canRerunByCount = aiReviewVersion < maxVersions;
  const canRerun = Boolean(isEligible && canRerunByTier && canRerunByCount);

  let note: ReactNode = null;
  if (!hasReview) {
    if (!startDt) {
      note = <div className="text-xs opacity-70">Chýba dátum aktivity.</div>;
    } else if (!isEligible) {
      note = (
        <div className="text-xs opacity-70">
          AI review je dostupné len pre aktivity z posledných 7 dní.
        </div>
      );
    } else {
      note = <div className="text-xs opacity-70">Zatiaľ bez AI review.</div>;
    }
  } else {
    note = (
      <div className="text-xs opacity-70">
        Tier: <span className="opacity-90">{tierCode}</span> · Verzia:{" "}
        <span className="opacity-90">
          {aiReviewVersion}/{maxVersions}
        </span>
        {aiReviewLastSource ? (
          <>
            {" "}
            · Zdroj: <span className="opacity-90">{aiReviewLastSource}</span>
          </>
        ) : null}
        {aiReviewLastUserCommentAt ? (
          <>
            {" "}
            · Posl. komentár:{" "}
            <span className="opacity-90">{aiReviewLastUserCommentAt}</span>
          </>
        ) : null}
      </div>
    );
  }

  const onRerun = async () => {
    if (!userId || !activityId || busyGen) return;

    setUiError(null);

    if (!isEligible) {
      setUiError("AI review je dostupné len pre aktivity z posledných 7 dní.");
      return;
    }

    if (!canRerun) {
      if (!canRerunByTier) {
        setUiError("Táto funkcia je dostupná len pre Classic/Pro.");
        return;
      }
      if (!canRerunByCount) {
        setUiError("Dosiahol si limit opätovných prepočtov pre túto aktivitu.");
        return;
      }
      setUiError("Rerun nie je dostupný.");
      return;
    }

    if (commentTooLong) {
      setUiError(`Komentár je príliš dlhý (max ${MAX_COMMENT_CHARS} znakov).`);
      return;
    }

    setBusyGen(true);
    try {
      const c = comment.trim();

      const out = await apiRerunActivityReview(Number(userId), Number(activityId), {
        comment: c.length ? c : null,
        model: null,
      });

      if (!out?.ok) {
        setUiError(out?.message || "Žiadosť bola zamietnutá.");
      } else {
        setComment("");
      }

      await reload();
    } catch (e: any) {
      console.error("[ActivityCoachReviewSection] rerun error", e);

      const msg =
        e?.detail?.message ||
        e?.message ||
        "Rerun sa nepodaril.";
      setUiError(String(msg));

      await reload();
    } finally {
      setBusyGen(false);
    }
  };

  const disabledReason =
    !userId
      ? "Missing userId"
      : !startDt
        ? "Chýba dátum aktivity"
        : !isEligible
          ? "Len pre aktivity z posledných 7 dní"
          : !canRerunByTier
            ? "Len pre Classic/Pro"
            : !canRerunByCount
              ? "Limit vyčerpaný"
              : commentTooLong
                ? "Komentár je príliš dlhý"
                : null;

  const actionBtn = (
    <Button
      type="button"
      variant="primary"
      size="sm"
      onClick={onRerun}
      disabled={!!disabledReason || busyGen}
      title={disabledReason ?? "Rerun AI activity review (async job)"}
    >
      {busyGen ? "Generating…" : "Re-run AI review"}
    </Button>
  );

  return (
    <ActivitySectionShell
      title="Coach komentár"
      defaultOpen={defaultOpen}
      items={[]}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{note}</div>
        <div className="shrink-0">{actionBtn}</div>
      </div>

      {/* comment input: len keď je to aspoň classic/pro a aktivita je eligible */}
      {isEligible && canRerunByTier && (
        <div className="mt-3">
          <div className="text-xs font-medium opacity-80">
            Poznámka pre AI (voliteľné)
          </div>
          <textarea
            className={[
              "mt-1 w-full rounded border bg-transparent p-2 text-sm",
              commentTooLong ? "border-red-500/60" : "border-white/10",
            ].join(" ")}
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Napíš, čo má AI zohľadniť (napr. únava, bolesť, cieľ tréningu, pocit...)."
          />
          <div className="mt-1 flex items-center justify-between text-[11px] opacity-70">
            <div>
              {commentTooLong ? (
                <span className="text-red-500/90">
                  Príliš veľa znakov. Max {MAX_COMMENT_CHARS}.
                </span>
              ) : (
                <span>Max {MAX_COMMENT_CHARS} znakov.</span>
              )}
            </div>
            <div className={commentTooLong ? "text-red-500/90" : ""}>
              {commentLen}/{MAX_COMMENT_CHARS}
            </div>
          </div>
        </div>
      )}

      {uiError && <div className="mt-3 text-xs text-red-500/90">{uiError}</div>}

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
          <div className="text-sm opacity-80">Zatiaľ bez zhodnotenia trénera.</div>
        )}

        {reviewUpdatedAt && (
          <div className="mt-3 text-[11px] opacity-60">
            Aktualizácia: {reviewUpdatedAt}
          </div>
        )}
      </div>
    </ActivitySectionShell>
  );
}