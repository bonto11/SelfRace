// src/app/shared/components/session/ActivityReviewSection.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";

import {
  apiGetActivityReview,
  apiRerunActivityReview,
} from "@/app/features/activities/api/activity_review";

import {
  getSubscriptionTier,
  subscribeSubscriptionTier,
} from "@/app/shared/state/subscriptionTierStore";

import type { ActivitySession } from "./SessionCard";
import { ActivitySectionShell } from "./ActivitySessionDetail";

type Props = {
  item: ActivitySession;
  activityId: number;
};

const MAX_COMMENT_CHARS = 900;

/* ================= date helpers ================= */

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

function safeJson(v: any): string {
  try {
    return JSON.stringify(v ?? null, null, 2);
  } catch {
    return String(v);
  }
}

/* ================= tier helpers ================= */

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
  return 1;
}

/* ================= UI helpers ================= */

function Chip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px]">
      <span className="opacity-70">{label}</span>
      <span className="font-medium opacity-95">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold opacity-85">{children}</div>;
}

function TextBlock({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed opacity-90">
      {children}
    </div>
  );
}

function fmtNum(v: any, digits = 0): string | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return digits > 0 ? n.toFixed(digits) : String(Math.round(n));
}

/* ================= component ================= */

export default function ActivityReviewSection({ item, activityId }: Props) {
  const { userId } = useUserId();
  const activityData: any = useActivityData() as any;
  const { getSummary } = activityData;

  const [tierCode, setTierCode] = useState<string>(() => {
    const storeTier = (getSubscriptionTier() || "").toLowerCase();
    return storeTier || getTierCodeFromInit(activityData) || "free";
  });

  useEffect(() => {
    const initTier = getTierCodeFromInit(activityData);
    const storeTier = (getSubscriptionTier() || "free").toLowerCase();

    console.log("[AR][tier] init=", initTier, "store=", storeTier);

    if (initTier && initTier !== "free" && storeTier === "free") {
      setTierCode(initTier.toLowerCase());
    }

    return subscribeSubscriptionTier((t) => {
      console.log("[AR][tier] store update =", t);
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

  // Raw GET payload (optional debug only)
  const [getPayload, setGetPayload] = useState<any | null>(null);

  // AI review object (schema v6)
  const [review, setReview] = useState<any | null>(null);

  // meta from GET row
  const [reviewUpdatedAt, setReviewUpdatedAt] = useState<string | null>(null);
  const [aiReviewVersion, setAiReviewVersion] = useState<number>(0);
  const [aiReviewLastSource, setAiReviewLastSource] = useState<string | null>(null);
  const [aiReviewLastUserCommentAt, setAiReviewLastUserCommentAt] = useState<string | null>(null);

  const [comment, setComment] = useState<string>("");
  const commentLen = comment.length;
  const commentTooLong = commentLen > MAX_COMMENT_CHARS;

  const [busyLoad, setBusyLoad] = useState(false);
  const [busyGen, setBusyGen] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const [showDebug, setShowDebug] = useState(false);

  const reload = async () => {
    if (!userId || !activityId) return;
    setBusyLoad(true);
    try {
      const out = await apiGetActivityReview(Number(userId), Number(activityId));
      setGetPayload(out);

      console.log("[AR][GET] out =", out);

      setReview(out?.review ?? null);
      setReviewUpdatedAt(formatUpdatedAt(out?.updated_at) ?? null);

      const v = Number((out as any)?.ai_review_version ?? 0);
      setAiReviewVersion(Number.isFinite(v) && v >= 0 ? v : 0);

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

      setUiError(null);
    } catch (e) {
      console.error("[AR][GET] error =", e);
      setGetPayload(null);
      setReview(null);
      setReviewUpdatedAt(null);
      setAiReviewVersion(0);
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

  const hasReview = review != null;

  const canRerunByTier = maxVersions > 1;
  const canRerunByCount = aiReviewVersion < maxVersions;
  const canRerun = Boolean(isEligible && canRerunByTier && canRerunByCount);

  const disabledReason =
    !userId
      ? "Missing userId"
      : !activityId
        ? "Missing activityId"
        : !startDt
          ? "Missing summary.date"
          : !isEligible
            ? "Only last 7 days"
            : !canRerunByTier
              ? `Tier '${tierCode}' has no rerun`
              : !canRerunByCount
                ? `Limit: ai_review_version=${aiReviewVersion} max_versions=${maxVersions}`
                : commentTooLong
                  ? `Comment too long: ${commentLen}/${MAX_COMMENT_CHARS}`
                  : null;

  // ---- review fields (schema v6) ----
  const r = review ?? {};
  const meta = r?.meta ?? {};
  const flags = r?.flags ?? {};
  const key = r?.key_numbers ?? {};

  const reviewText: string | null =
    typeof r?.review_text === "string" ? r.review_text.trim() : null;

  const nextDayPlan: string | null =
    typeof r?.next_day_plan === "string" ? r.next_day_plan.trim() : null;

  const confidence = fmtNum(r?.confidence_0_to_100, 0);

  const generatedAt =
    typeof r?.generated_at === "string" ? formatUpdatedAt(r.generated_at) : null;

  // key numbers
  const distanceKm = fmtNum(key?.distance_km, 2);
  const durationMin = fmtNum(key?.duration_min, 1);
  const avgHr = fmtNum(key?.avg_hr_bpm, 0);
  const maxHr = fmtNum(key?.max_hr_bpm, 0);
  const domZ = typeof key?.dominant_zone === "string" ? key.dominant_zone : null;

  let note: ReactNode = null;
  if (!hasReview) {
    note = (
      <div className="text-xs opacity-70">
        {startDt && isEligible
          ? "Zatiaľ bez zhodnotenia trénera."
          : !startDt
            ? "Chýba dátum aktivity."
            : "AI review je dostupné len pre aktivity z posledných 7 dní."}
      </div>
    );
  } else {
    note = (
      <div className="text-xs opacity-70">
        Verzia: <span className="opacity-90">{aiReviewVersion}/{maxVersions}</span>
        {aiReviewLastSource ? (
          <>
            {" "}
            · Zdroj: <span className="opacity-90">{aiReviewLastSource}</span>
          </>
        ) : null}
        {aiReviewLastUserCommentAt ? (
          <>
            {" "}
            · Posl. komentár: <span className="opacity-90">{aiReviewLastUserCommentAt}</span>
          </>
        ) : null}
      </div>
    );
  }

  const onRerun = async () => {
    if (!userId || !activityId || busyGen) return;

    console.log("[AR][RERUN] click", { disabledReason });
    setUiError(null);

    if (disabledReason) {
      setUiError(disabledReason);
      return;
    }

    setBusyGen(true);
    try {
      const c = comment.trim();

      console.log("[AR][RERUN] request", {
        userId,
        activityId,
        commentLen: c.length,
        comment_preview: c ? c.slice(0, 180) : null,
      });

      const out = await apiRerunActivityReview(Number(userId), Number(activityId), {
        comment: c.length ? c : null,
        model: null,
      });

      console.log("[AR][RERUN] response", out);

      if (!out?.ok) {
        setUiError(out?.message || "Žiadosť bola zamietnutá.");
      } else {
        setComment("");
      }

      await reload();
    } catch (e: any) {
      console.error("[AR][RERUN] error", e);
      console.error("[AR][RERUN] error.detail", e?.detail);

      const msg = e?.detail?.message || e?.message || "Rerun sa nepodaril.";
      setUiError(String(msg));

      await reload();
    } finally {
      setBusyGen(false);
    }
  };

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
    <ActivitySectionShell title="Coach komentár" defaultOpen={true} items={[]}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{note}</div>
        <div className="shrink-0">{actionBtn}</div>
      </div>

      {/* comment input (classic/pro + eligible) */}
      {isEligible && canRerunByTier && (
        <div className="mt-3">
          <div className="text-xs font-medium opacity-80">Poznámka pre AI (voliteľné)</div>
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

        {/* ===== Pretty review ===== */}
        {!busyLoad && hasReview && (
          <div className="mt-3 grid gap-4">
            {/* Header line */}
            <div className="flex flex-wrap items-center gap-2">
              {typeof r?.sport === "string" && <Chip label="Šport" value={r.sport} />}
              {typeof r?.session_kind === "string" && (
                <Chip label="Typ" value={r.session_kind} />
              )}
              {generatedAt && <Chip label="Vygenerované" value={generatedAt} />}
              {confidence && <Chip label="Confidence" value={`${confidence}/100`} />}
              {flags?.needs_caution === true && <Chip label="Pozor" value={"⚠️"} />}
              {flags?.used_user_comment === true && <Chip label="Komentár" value={"použitý"} />}
            </div>

            {/* Key numbers */}
            <div>
              <SectionTitle>Kľúčové čísla</SectionTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                {distanceKm && <Chip label="Vzdialenosť" value={`${distanceKm} km`} />}
                {durationMin && <Chip label="Trvanie" value={`${durationMin} min`} />}
                {avgHr && <Chip label="Avg HR" value={`${avgHr} bpm`} />}
                {maxHr && <Chip label="Max HR" value={`${maxHr} bpm`} />}
                {domZ && <Chip label="Dominantná zóna" value={domZ} />}
              </div>
            </div>

            {/* Review text */}
            <div>
              <SectionTitle>Hodnotenie</SectionTitle>
              <TextBlock>{reviewText || "—"}</TextBlock>
            </div>

            {/* Next day plan */}
            <div>
              <SectionTitle>Čo zajtra</SectionTitle>
              <TextBlock>{nextDayPlan || "—"}</TextBlock>
            </div>

            {/* Meta (small) */}
            <div className="text-[11px] opacity-70">
              {meta?.source ? <>Zdroj: <span className="opacity-90">{String(meta.source)}</span></> : null}
              {meta?.user_comment_present != null ? (
                <>
                  {" "}
                  · Komentár:{" "}
                  <span className="opacity-90">
                    {meta.user_comment_used ? "použitý" : meta.user_comment_present ? "nepoužitý" : "žiadny"}
                  </span>
                </>
              ) : null}
              {meta?.user_comment_len != null ? (
                <>
                  {" "}
                  · Dĺžka: <span className="opacity-90">{String(meta.user_comment_len)}</span>
                </>
              ) : null}
              {typeof r?.model === "string" ? (
                <>
                  {" "}
                  · Model: <span className="opacity-90">{r.model}</span>
                </>
              ) : null}
              {typeof r?.schema_version === "number" ? (
                <>
                  {" "}
                  · Schema: <span className="opacity-90">{r.schema_version}</span>
                </>
              ) : null}
            </div>
          </div>
        )}

        {!busyLoad && !hasReview && (
          <div className="text-sm opacity-80">Zatiaľ bez zhodnotenia trénera.</div>
        )}

        {reviewUpdatedAt && (
          <div className="mt-3 text-[11px] opacity-60">Aktualizácia: {reviewUpdatedAt}</div>
        )}

        {/* ===== Optional debug ===== */}
        <div className="mt-4">
          <button
            type="button"
            className="text-[11px] opacity-70 hover:opacity-90"
            onClick={() => setShowDebug((x) => !x)}
          >
            {showDebug ? "Skryť debug" : "Zobraziť debug"}
          </button>

          {showDebug && (
            <pre className="mt-2 max-h-80 overflow-auto rounded border border-white/10 bg-black/30 p-3 text-[11px] leading-snug">
              {safeJson({ review, getPayload })}
            </pre>
          )}
        </div>
      </div>
    </ActivitySectionShell>
  );
}