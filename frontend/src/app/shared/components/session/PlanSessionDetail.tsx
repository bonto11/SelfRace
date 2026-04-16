// src/app/shared/components/session/PlanSessionDetail.tsx
"use client";

import type { ComponentVariant } from "@/app/features/activities/types/activities";
import DetailSection from "@/app/shared/components/session/DetailSection";
import {
  fmtMin,
  safeText,
} from "@/app/shared/components/session/sessionUtils";
import type { PlanSession } from "@/app/shared/components/session/SessionCard";
import { useT } from "@/app/shared/i18n/useT";
import { STRENGTH_CATALOG_FE } from "@/app/shared/constants/strengthCatalog";
import {
  SESSION_MINIGRID_BASE,
  SESSION_MINIGRID_2COL,
  SESSION_MINIGRID_3COL,
  SESSION_MINITILE,
  SESSION_MINITILE_STYLE,
  SESSION_MINITILE_LABEL,
  SESSION_MINITILE_VALUE,
  PLAN_STRUCT_STACK,
  PLAN_BLOCK,
  PLAN_BLOCK_LABEL,
  PLAN_BLOCK_TEXT,
  PLAN_MAIN_STACK,
  PLAN_MAIN_ITEM,
  PLAN_MAIN_ITEM_STYLE,
  PLAN_MAIN_NOTE,
  PLAN_EX_LIST,
  PLAN_EX_ITEM,
  PLAN_EX_ITEM_STYLE,
  PLAN_EX_NAME,
  PLAN_EX_LINE,
  PLAN_EX_NOTE,
  PLAN_DEBUG_PRE,
} from "@/app/shared/ui/tokens";

// --- Pomocné funkcie ---

function getDuration(block: any): string | null {
  if (typeof block === "string") return null;
  const m = block?.duration_min ?? block?.minutes ?? block?.work_min;
  return m ? fmtMin(m) : null;
}

function getNote(block: any): string | null {
  if (typeof block === "string") return block;
  return block?.instruction ?? block?.notes ?? null;
}

function MiniMetricGrid({
  metrics,
  cols = 3,
}: {
  metrics: any[];
  cols?: 2 | 3;
}) {
  if (!metrics?.length) return null;
  const colClass = cols === 2 ? SESSION_MINIGRID_2COL : SESSION_MINIGRID_3COL;
  return (
    <div className={[SESSION_MINIGRID_BASE, colClass].join(" ")}>
      {metrics.map((m, i) => (
        <div
          key={i}
          className={SESSION_MINITILE}
          style={SESSION_MINITILE_STYLE}
        >
          <div className={SESSION_MINITILE_LABEL}>{m.label}</div>
          <div className={SESSION_MINITILE_VALUE}>{m.value ?? "—"}</div>
        </div>
      ))}
    </div>
  );
}

export default function PlanSessionDetail({
  item,
  showPlanDebug,
  showAdvanced = false, // 👈 PARAMETER Z MATKY
}: {
  variant?: ComponentVariant;
  item: PlanSession;
  showPlanDebug: boolean;
  showAdvanced?: boolean;
}) {
  const t = useT();
  const currentLang = (t as any)?.locale?.startsWith("en") ? "en" : "sk";

  const raw = item.planRaw ?? undefined;
  const structure = item.planStructure ?? raw?.structure ?? undefined;

  // 1. Spracovanie Cvikov (Strength)
  const strengthActivation = (structure as any)?.activation || [];
  const strengthMainPart = (structure as any)?.strength_main_part || [];
  const strengthAddOns = (structure as any)?.add_ons || [];

  const hasStrength =
    strengthActivation.length > 0 ||
    strengthMainPart.length > 0 ||
    strengthAddOns.length > 0;

  // 2. Spracovanie Endurance (Beh/Bike)
  const wu = (structure as any)?.warmup;
  const rawMain = (structure as any)?.main_part;
  const mainBlocks = Array.isArray(rawMain)
    ? rawMain
    : rawMain
      ? [rawMain]
      : [];
  const cd = (structure as any)?.cooldown;

  const hasEnduranceStructure = wu || mainBlocks.length > 0 || cd;

  // Metriky pre MiniGrid
  const metrics = (
    item.kpis?.length
      ? item.kpis
      : [
          item.planDur
            ? { label: t("common.metrics.duration"), value: item.planDur }
            : null,
          item.planIntensity
            ? {
                label: t("prefs.sections.rulesSection.intensityLabel"),
                value: item.planIntensity,
              }
            : null,
          item.planTarget
            ? {
                label: t("sessions.detail.plan.target"),
                value: item.planTarget,
              }
            : null,
        ]
  ).filter(Boolean);

  const renderExerciseList = (exercises: any[], fallbackLabel: string) => (
    <ul className={PLAN_EX_LIST}>
      {exercises.map((e: any, i: number) => {
        const id = e?.exercise_id;
        const catalogName =
          id && STRENGTH_CATALOG_FE[id]
            ? STRENGTH_CATALOG_FE[id][currentLang]
            : null;
        const formattedId = id ? id.replace(/_/g, " ") : null;

        const displayName =
          catalogName ||
          e?.exercise_name ||
          formattedId ||
          `${fallbackLabel} ${i + 1}`;

        // Oprava formátovania pre opakovania (ak to obsahuje "s" alebo "min", nedávame tam slovo "opak.")
        const repsString = String(e?.reps || "");
        const hasTimeFormat = repsString.includes("s") || repsString.includes("min");
        const formattedReps = e?.reps 
          ? (hasTimeFormat ? e.reps : `${e.reps} ${t("sessions.detail.unitReps") || "opak."}`) 
          : null;

        return (
          <li key={i} className={PLAN_EX_ITEM} style={PLAN_EX_ITEM_STYLE}>
            <div
              className={PLAN_EX_NAME}
              style={{ textTransform: "capitalize", fontWeight: showAdvanced ? "600" : "400" }}
            >
              {displayName}
            </div>
            
            {/* 🔐 UKÁŽE SA LEN V DETAILNOM REŽIME */}
            {showAdvanced && (
              <div className="mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className={PLAN_EX_LINE}>
                  {[
                    e?.sets
                      ? `${e.sets} ${t("sessions.detail.unitSets") || "sérií"}`
                      : null,
                    formattedReps,
                    e?.seconds
                      ? `${e.seconds}${t("sessions.detail.unitSec") || "s"}`
                      : null,
                    e?.rest_sec || e?.rest_s
                      ? `${t("sessions.detail.unitRest") || "Pauza"} ${e.rest_sec || e.rest_s}s`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
                {e?.notes && (
                  <div className={PLAN_EX_NOTE}>{safeText(e.notes)}</div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-4">
      {/* Vždy viditeľný jednoduchý základný panel */}
      <MiniMetricGrid metrics={metrics} cols={3} />

      {/* --- SEKCIA: ŠTRUKTÚRA TRÉNINGU (Endurance) --- */}
      {hasEnduranceStructure && (
        <DetailSection title={t("sessions.detail.sectionStructure")}>
          
          {/* 🔐 Modrá poznámka sa ukáže len v detailoch */}
          {showAdvanced && (item.sport === "run" || item.sport === "ride") && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs leading-relaxed text-blue-200/90 italic animate-in fade-in">
              <strong>{t("common.note") || "Poznámka"}:</strong>{" "}
              {t("sessions.detail.plan.noteEndurance") || "Tempá sú orientačné (vhodné pre GPS v telefóne). Ak máš športové hodinky, prioritne sa riaď tepom. Ak nie, riaď sa pocitom."}
            </div>
          )}
          
          <div className={PLAN_STRUCT_STACK}>
            {wu && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>
                  {t("sessions.detail.plan.warmup")}
                </div>
                <div className={PLAN_BLOCK_TEXT}>
                  {typeof wu === "string" ? wu : getDuration(wu) || "—"}
                </div>
                {/* 🔐 Poznámky zobrazené iba v detailnom režime */}
                {showAdvanced && typeof wu !== "string" && getNote(wu) && (
                  <div className={PLAN_MAIN_NOTE + " mt-1 animate-in fade-in"}>{safeText(getNote(wu))}</div>
                )}
              </div>
            )}

            {mainBlocks.length > 0 && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>
                  {t("sessions.detail.plan.main")}
                </div>
                <div className={PLAN_MAIN_STACK}>
                  {mainBlocks.map((blk: any, idx: number) => {
                    if (typeof blk === "string") {
                      return (
                        <div key={idx} className={PLAN_MAIN_ITEM} style={PLAN_MAIN_ITEM_STYLE}>
                          <div className={PLAN_MAIN_NOTE}>{safeText(blk)}</div>
                        </div>
                      );
                    }

                    const isInterval = blk.kind === "interval_block";

                    if (isInterval) {
                      const reps = blk.repeats || 1;
                      const workDur = getDuration(blk.work);
                      const restDur = getDuration(blk.rest);
                      const workNote = getNote(blk.work);

                      return (
                        <div key={idx} className={PLAN_MAIN_ITEM} style={PLAN_MAIN_ITEM_STYLE}>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-white font-bold text-base">
                              {reps}×
                            </span>
                            <span className="opacity-90">
                              {workDur}{" "}
                              {showAdvanced && <span className="opacity-60 text-xs">({t("sessions.detail.plan.work")})</span>}
                            </span>
                            {restDur && (
                              <span className="opacity-60">
                                + {restDur}{" "}
                                {showAdvanced && <span className="text-xs">({t("sessions.detail.plan.recovery")})</span>}
                              </span>
                            )}
                          </div>
                          {/* 🔐 Poznámky zobrazené iba v detailnom režime */}
                          {showAdvanced && workNote && (
                            <div className={PLAN_MAIN_NOTE + " mt-1 animate-in fade-in"}>
                              {safeText(workNote)}
                            </div>
                          )}
                        </div>
                      );
                    }

                    const dur = getDuration(blk);
                    const note = getNote(blk);

                    return (
                      <div key={idx} className={PLAN_MAIN_ITEM} style={PLAN_MAIN_ITEM_STYLE}>
                        <div className="font-semibold text-white/90">
                          {dur || "—"}
                        </div>
                        {/* 🔐 Poznámky zobrazené iba v detailnom režime */}
                        {showAdvanced && note && (
                          <div className={PLAN_MAIN_NOTE + " mt-1 animate-in fade-in"}>{safeText(note)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {cd && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>
                  {t("sessions.detail.plan.cooldown")}
                </div>
                <div className={PLAN_BLOCK_TEXT}>
                  {typeof cd === "string" ? cd : getDuration(cd) || "—"}
                </div>
                {/* 🔐 Poznámky zobrazené iba v detailnom režime */}
                {showAdvanced && typeof cd !== "string" && getNote(cd) && (
                  <div className={PLAN_MAIN_NOTE + " mt-1 animate-in fade-in"}>{safeText(getNote(cd))}</div>
                )}
              </div>
            )}
          </div>
        </DetailSection>
      )}

      {/* --- SEKCIA: CVIKY (Strength) --- */}
      {hasStrength && (
        <DetailSection title={t("sessions.detail.sectionExercises")}>
          <div className={PLAN_STRUCT_STACK}>
            {strengthActivation.length > 0 && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>
                  {t("sessions.detail.plan.activation")}
                </div>
                {renderExerciseList(strengthActivation, "Cvik")}
              </div>
            )}
            {strengthMainPart.length > 0 && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>
                  {t("sessions.detail.plan.strengthMain")}
                </div>
                {renderExerciseList(strengthMainPart, "Cvik")}
              </div>
            )}
            {strengthAddOns.length > 0 && (
              <div className={PLAN_BLOCK}>
                <div className={PLAN_BLOCK_LABEL}>
                  {t("sessions.detail.plan.addOns")}
                </div>
                {renderExerciseList(strengthAddOns, "Cvik")}
              </div>
            )}
          </div>
        </DetailSection>
      )}

      {/* --- DEBUG SEKCIA --- */}
      {showAdvanced && showPlanDebug && (
        <DetailSection title={t("sessions.detail.sectionDebug")} defaultOpen={false}>
          <pre className={PLAN_DEBUG_PRE + " animate-in fade-in"}>{safeText({ structure, raw })}</pre>
        </DetailSection>
      )}
    </div>
  );
}