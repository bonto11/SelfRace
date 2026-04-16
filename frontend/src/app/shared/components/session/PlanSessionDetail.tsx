// src/app/shared/components/session/PlanSessionDetail.tsx
"use client";

import { useState } from "react"; // 👈 Pridali sme React State
import type { ComponentVariant } from "@/app/features/activities/types/activities";
import DetailSection from "@/app/shared/components/session/DetailSection";
import {
  fmtMin,
  safeText,
  tgtToStr,
} from "@/app/shared/components/session/sessionUtils";
import type { PlanSession } from "@/app/shared/components/session/SessionCard";
import { useT } from "@/app/shared/i18n/useT";
import { STRENGTH_CATALOG_FE } from "@/app/shared/constants/strengthCatalog";
import { appColors } from "@/app/shared/ui/theme/app_colors"; // 👈 Na farbu prepínača
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
  PLAN_MAIN_TGT,
  PLAN_MAIN_NOTE,
  PLAN_EX_LIST,
  PLAN_EX_ITEM,
  PLAN_EX_ITEM_STYLE,
  PLAN_EX_NAME,
  PLAN_EX_LINE,
  PLAN_EX_NOTE,
  PLAN_DEBUG_PRE,
} from "@/app/shared/ui/tokens";

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
}: {
  variant?: ComponentVariant;
  item: PlanSession;
  showPlanDebug: boolean;
}) {
  const t = useT();
  const currentLang = (t as any)?.locale?.startsWith("en") ? "en" : "sk";

  // 🛡️ Náš nový stav pre Progressive Disclosure (defaultne vypnuté / Simple)
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  // 3. Potrebujeme vôbec ukázať toggle prepínač?
  const hasAdvancedContent = hasEnduranceStructure || hasStrength || showPlanDebug;

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

        return (
          <li key={i} className={PLAN_EX_ITEM} style={PLAN_EX_ITEM_STYLE}>
            <div
              className={PLAN_EX_NAME}
              style={{ textTransform: "capitalize" }}
            >
              {displayName}
            </div>
            <div className={PLAN_EX_LINE}>
              {[
                e?.sets
                  ? `${e.sets} ${t("sessions.detail.unitSets") || "sérií"}`
                  : null,
                e?.reps
                  ? `${e.reps} ${t("sessions.detail.unitReps") || "opak."}`
                  : null,
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
          </li>
        );
      })}
    </ul>
  );

  return (
    <div>
      {/* Vždy viditeľný jednoduchý základný panel (Pre ne-geekov) */}
      <MiniMetricGrid metrics={metrics} cols={3} />

      {/* 🌟 TOGGLE PREPÍNAČ PRE POKROČILÝ REŽIM */}
      {hasAdvancedContent && (
        <div
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mt-4 flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border select-none"
          style={{
            backgroundColor: showAdvanced ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.15)",
            borderColor: showAdvanced ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.02)",
          }}
        >
          <div>
            <div className="text-sm font-semibold text-white/90 leading-tight">
              {t("sessions.detail.advancedToggle")}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">
              {t("sessions.detail.advancedToggleDesc")}
            </div>
          </div>
          <div
            className={`relative inline-flex items-center h-[22px] rounded-full w-10 transition-colors ${
              showAdvanced ? "bg-blue-500" : "bg-white/10"
            }`}
          >
            <span
              className={`inline-block w-4 h-4 bg-white rounded-full transition-transform ${
                showAdvanced ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </div>
        </div>
      )}

      {/* 🔐 SKRYTÁ SEKCIA S DETAILMI (Ukáže sa len ak showAdvanced === true) */}
      {showAdvanced && (
        <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          
          {/* --- SEKCIA: ŠTRUKTÚRA TRÉNINGU (Endurance) --- */}
          {hasEnduranceStructure && (
            <DetailSection title={t("sessions.detail.sectionStructure")}>
              {(item.sport === "run" || item.sport === "ride") && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs leading-relaxed text-blue-200/80 italic">
                  <strong>{t("common.note")}:</strong>{" "}
                  {t("sessions.detail.plan.noteEndurance")}
                </div>
              )}
              <div className={PLAN_STRUCT_STACK}>
                {wu && (
                  <div className={PLAN_BLOCK}>
                    <div className={PLAN_BLOCK_LABEL}>
                      {t("sessions.detail.plan.warmup")}
                    </div>
                    <div className={PLAN_BLOCK_TEXT}>
                      {typeof wu === "string"
                        ? wu
                        : [getDuration(wu), getNote(wu)]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                    </div>
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
                            <div
                              key={idx}
                              className={PLAN_MAIN_ITEM}
                              style={PLAN_MAIN_ITEM_STYLE}
                            >
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
                            <div
                              key={idx}
                              className={PLAN_MAIN_ITEM}
                              style={PLAN_MAIN_ITEM_STYLE}
                            >
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-white font-bold text-base">
                                  {reps}×
                                </span>
                                <span className="opacity-90">
                                  {workDur}{" "}
                                  <span className="opacity-60 text-xs">
                                    ({t("sessions.detail.plan.work")})
                                  </span>
                                </span>
                                {restDur && (
                                  <span className="opacity-60">
                                    + {restDur}{" "}
                                    <span className="text-xs">
                                      ({t("sessions.detail.plan.recovery")})
                                    </span>
                                  </span>
                                )}
                              </div>

                              {workNote && (
                                <div className={PLAN_MAIN_NOTE}>
                                  {safeText(workNote)}
                                </div>
                              )}
                            </div>
                          );
                        }

                        const dur = getDuration(blk);
                        const note = getNote(blk);

                        return (
                          <div
                            key={idx}
                            className={PLAN_MAIN_ITEM}
                            style={PLAN_MAIN_ITEM_STYLE}
                          >
                            <div className="font-semibold text-white/90">
                              {dur || "—"}
                            </div>
                            {note && (
                              <div className={PLAN_MAIN_NOTE}>{safeText(note)}</div>
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
                      {typeof cd === "string"
                        ? cd
                        : [getDuration(cd), getNote(cd)]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                    </div>
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
                      {t("sessions.detail.plan.activation") || "Aktivácia"}
                    </div>
                    {renderExerciseList(strengthActivation, "Cvik")}
                  </div>
                )}
                {strengthMainPart.length > 0 && (
                  <div className={PLAN_BLOCK}>
                    <div className={PLAN_BLOCK_LABEL}>
                      {t("sessions.detail.plan.strengthMain") || "Hlavná časť"}
                    </div>
                    {renderExerciseList(strengthMainPart, "Cvik")}
                  </div>
                )}
                {strengthAddOns.length > 0 && (
                  <div className={PLAN_BLOCK}>
                    <div className={PLAN_BLOCK_LABEL}>
                      {t("sessions.detail.plan.addOns") || "Doplnky a jadro"}
                    </div>
                    {renderExerciseList(strengthAddOns, "Cvik")}
                  </div>
                )}
              </div>
            </DetailSection>
          )}

          {/* --- DEBUG SEKCIA --- */}
          {showPlanDebug && (
            <DetailSection
              title={t("sessions.detail.sectionDebug")}
              defaultOpen={false}
            >
              <pre className={PLAN_DEBUG_PRE}>{safeText({ structure, raw })}</pre>
            </DetailSection>
          )}
        </div>
      )}
    </div>
  );
}