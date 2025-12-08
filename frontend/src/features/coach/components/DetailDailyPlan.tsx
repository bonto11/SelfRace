// src/features/coach/components/DetailDailyPlan.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { SURFACE_CARD } from "@/shared/ui/classes";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/shared/hooks/useUserId";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";

import PlanPreview from "@/features/coach/components/PlanPreview";
import PlanActive from "@/features/coach/components/PlanActive";

import {
  apiGenerateDailyForWeek,
  apiSaveActivePlan,
  apiCancelActivePlan,
  apiContinuePlan,
} from "@/features/coach/api/coach_plan_daily";

import { buildDailyAnalysisFromPlan } from "@/features/coach/utils/dailyPreviewAdapter";

type BusyAction = "generate" | "apply" | "cancel" | "extend" | null;

export default function DetailDailyPlan() {
  const { userId } = useUserId();
  const planCtx = usePlanData() as any;

  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // preview = objekt, ktorý posúvame do <PlanPreview result={...}>
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  // analysis = čistý objekt, ktorý dávame do apiSaveActivePlan
  const [previewAnalysis, setPreviewAnalysis] = useState<any | null>(null);
  const [previewMeta, setPreviewMeta] = useState<any | null>(null);

  const hasActivePlan = useMemo(() => {
    const rows = (planCtx?.planRows ?? planCtx?.rows ?? []) as any[];
    return Array.isArray(rows) && rows.length > 0;
  }, [planCtx]);

  const activePlanId: string | null =
    (planCtx as any)?.planId ?? (planCtx as any)?.plan_id ?? null;

  // po mount-e zatiaľ nenačítavame nič – preview sa generuje na klik

  if (!userId) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 text-sm">
          Chýba userId (useUserId). Skontroluj prihlásenie používateľa.
        </div>
      </div>
    );
  }

  const handleGenerate = async () => {
    setBusy("generate");
    setError(null);
    setStatus(null);
    try {
      // zatiaľ fixne week_index=1, plan_id nechávame null
      const resp = await apiGenerateDailyForWeek(userId, {
        week_index: 1,
        plan_id: null,
        overwrite: false,
      });

      const { analysis, meta } = buildDailyAnalysisFromPlan(resp);
      setPreviewAnalysis(analysis);
      setPreviewMeta(meta);
      setPreviewResult({ analysis });

      setStatus("AI daily plán bol vygenerovaný (preview).");
    } catch (e: any) {
      setError(e?.message ?? "Chyba pri generovaní daily plánu.");
    } finally {
      setBusy(null);
    }
  };

  const handleApplyPreview = async () => {
    if (!previewAnalysis) {
      setError("Najprv vygeneruj plán (Preview).");
      return;
    }
    setBusy("apply");
    setError(null);
    setStatus(null);

    try {
      const res = await apiSaveActivePlan(userId, previewAnalysis, previewMeta);
      if (!res?.success) {
        throw new Error("API vrátilo neúspech pri ukladaní plánu.");
      }
      setStatus(
        hasActivePlan
          ? "Aktívny plán bol aktualizovaný podľa najnovšieho AI preview."
          : "Aktívny plán bol vytvorený a spustený."
      );
      // najjednoduchšie – re-load, nech si PlanDataProvider natiahne nové dáta
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (e: any) {
      setError(e?.message ?? "Chyba pri ukladaní aktívneho plánu.");
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    setBusy("cancel");
    setError(null);
    setStatus(null);

    try {
      const res = await apiCancelActivePlan(userId, activePlanId ?? null);
      if (!res?.success) {
        throw new Error("API vrátilo neúspech pri zrušení plánu.");
      }
      setStatus("Aktívny plán bol zrušený.");
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (e: any) {
      setError(e?.message ?? "Chyba pri rušení aktívneho plánu.");
    } finally {
      setBusy(null);
    }
  };

  const handleExtend = async () => {
    // voliteľné – jednoduchý „update“ aktívneho plánu (predĺženie horizontu)
    setBusy("extend");
    setError(null);
    setStatus(null);

    try {
      const res = await apiContinuePlan(userId, 10);
      if (!res?.success) {
        throw new Error("API vrátilo neúspech pri aktualizácii plánu.");
      }
      setStatus(
        `Plán bol aktualizovaný, horizon: ${res.plan_start} – ${res.plan_end}.`
      );
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (e: any) {
      setError(e?.message ?? "Chyba pri aktualizácii aktívneho plánu.");
    } finally {
      setBusy(null);
    }
  };

  const isBusy = busy !== null;

  return (
    <div className="space-y-4">
      {/* HLAVNÝ CONTROL PANEL */}
      <section className={SURFACE_CARD}>
        <div className="px-4 pt-4 pb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              AI Daily plan – správa plánu
            </h2>
            <p className="mt-1 text-xs text-slate-400 max-w-xl">
              1) Vygeneruj AI daily plán ako <strong>Preview</strong>.{" "}
              2) Ak sa ti páči, spusti alebo aktualizuj{" "}
              <strong>aktívny plán</strong>. 3) Aktívny plán vieš neskôr zrušiť
              alebo predĺžiť horizont.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs md:text-sm">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isBusy}
              className="inline-flex items-center rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-3 py-1.5 font-medium"
            >
              {busy === "generate" ? "Generujem…" : "Vygenerovať / obnoviť preview"}
            </button>

            <button
              type="button"
              onClick={handleApplyPreview}
              disabled={isBusy || !previewAnalysis}
              className="inline-flex items-center rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-60 px-3 py-1.5 font-medium"
            >
              {busy === "apply"
                ? "Ukladám…"
                : hasActivePlan
                ? "Aktualizovať aktívny plán"
                : "Spustiť nový plán"}
            </button>

            {hasActivePlan && (
              <>
                <button
                  type="button"
                  onClick={handleExtend}
                  disabled={isBusy}
                  className="inline-flex items-center rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-60 px-3 py-1.5 font-medium"
                >
                  {busy === "extend" ? "Aktualizujem…" : "Update / predĺžiť plán"}
                </button>

                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isBusy}
                  className="inline-flex items-center rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-60 px-3 py-1.5 font-medium"
                >
                  {busy === "cancel" ? "Ruším…" : "Zrušiť aktívny plán"}
                </button>
              </>
            )}
          </div>
        </div>

        {(status || error || isBusy) && (
          <div className="px-4 pb-4 flex items-center gap-3 text-xs">
            {isBusy && (
              <span className="inline-flex">
                <LoadingSpinner size="button" />
              </span>
            )}
            {status && (
              <span className="text-emerald-300">
                {status}
              </span>
            )}
            {error && (
              <span className="text-red-300">
                {error}
              </span>
            )}
          </div>
        )}

        <div className="h-1.5 rounded-b-2xl bg-emerald-500/80" />
      </section>

      {/* PREVIEW PANEL – ak máme AI preview */}
      {previewResult && (
        <section>
          <PlanPreview result={previewResult} showDebugSplit={false} />
        </section>
      )}

      {/* ACTIVE PANEL – ak existuje aktívny plán */}
      {hasActivePlan && (
        <section>
          <PlanActive />
        </section>
      )}

      {!previewResult && !hasActivePlan && (
        <section className={SURFACE_CARD}>
          <div className="px-4 py-4 text-sm">
            Zatiaľ nemáš AI daily plán. Klikni na{" "}
            <strong>„Vygenerovať / obnoviť preview“</strong> a pozri si návrh
            tréningov na najbližšie dni.
          </div>
        </section>
      )}
    </div>
  );
}