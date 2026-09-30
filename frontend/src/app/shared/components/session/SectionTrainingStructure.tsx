// src/app/shared/components/session/SectionTrainingStructure.tsx
"use client";

import { ActivitySectionShell } from "@/app/shared/components/session/DetailActivity";
import { fmtMin, safeText } from "@/app/shared/components/session/sessionUtils";
import { useT } from "@/app/shared/i18n/useT";
import {
  PLAN_STRUCT_STACK,
  PLAN_BLOCK,
  PLAN_BLOCK_LABEL,
  PLAN_BLOCK_TEXT,
  PLAN_MAIN_STACK,
  PLAN_MAIN_ITEM,
  PLAN_MAIN_ITEM_STYLE,
  PLAN_MAIN_NOTE,
} from "@/app/shared/ui/tokens";

/**
 * 🌟 NOVÉ: vzdialenosť úseku/pauzy. Pod 1 km v metroch, inak v km
 * (max 2 desatinné miesta, desatinná čiarka podľa locale).
 */
function fmtDistance(meters: number, locale: string): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = (meters / 1000).toLocaleString(locale, { maximumFractionDigits: 2 });
  return `${km} km`;
}

/**
 * 🌟 NOVÉ: trvanie v sekundách. Celé minúty cez fmtMin (zhodne so
 * zvyškom appky), inak "M:SS min" (napr. 90 s -> "1:30 min", 30 s -> "0:30 min").
 */
function fmtSeconds(sec: number): string {
  if (sec % 60 === 0) return fmtMin(sec / 60) ?? `${sec / 60} min`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")} min`;
}


/**
 * Dĺžka bloku. Poradie: distance_m (ručné intervaly na vzdialenosť) ->
 * duration_s (ručné intervaly na čas) -> minutes/duration_min/work_min
 * (AI plány, rozcvička, výklus). 0 / prázdne = null (nezobrazí sa).
 */
function getDuration(block: any, locale: string): string | null {
  if (!block || typeof block === "string") return null;

  const dist = Number(block.distance_m);
  if (Number.isFinite(dist) && dist > 0) return fmtDistance(dist, locale);

  const sec = Number(block.duration_s);
  if (block.duration_s != null && Number.isFinite(sec)) {
    return sec > 0 ? fmtSeconds(Math.round(sec)) : null;
  }

  const m = block.duration_min ?? block.minutes ?? block.work_min;
  return m ? fmtMin(m) : null;
}

function getNote(block: any): string | null {
  if (typeof block === "string") return block;
  return block?.instruction ?? block?.notes ?? null;
}

export type SectionTrainingStructureProps = {
  structure: any;
  sport: string;
  showAdvanced?: boolean;
  status?: string;
};

/**
 * SectionTrainingStructure - endurance (beh/bike) štruktúra tréningu:
 * rozcvička / hlavná časť / výklus, vrátane interval blokov.
 */
export function hasTrainingStructure(structure: any): boolean {
  const wu = structure?.warmup;
  const rawMain = structure?.main_part;
  const mainBlocks = Array.isArray(rawMain) ? rawMain : rawMain ? [rawMain] : [];
  const cd = structure?.cooldown;
  return !!(wu || mainBlocks.length > 0 || cd);
}

export default function SectionTrainingStructure({
  structure,
  sport,
  showAdvanced = false,
  status,
}: SectionTrainingStructureProps) {
  const t = useT();
  const locale = (t("common.locale" as any) as string) || "sk-SK";

  const wu = structure?.warmup;
  const rawMain = structure?.main_part;
  const mainBlocks = Array.isArray(rawMain) ? rawMain : rawMain ? [rawMain] : [];
  const cd = structure?.cooldown;

  if (!hasTrainingStructure(structure)) return null;

  return (
    <ActivitySectionShell
      title={t("sessions.detail.sectionStructure")}
      defaultOpen={status !== "done"}
      items={[]}
    >
      {showAdvanced && (sport === "run" || sport === "ride") && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs leading-relaxed text-blue-200/90 italic animate-in fade-in">
          <strong>{t("common.note") || "Poznámka"}:</strong>{" "}
          {t("sessions.detail.plan.noteEndurance") ||
            "Tempá sú orientačné (vhodné pre GPS v telefóne). Ak máš športové hodinky, prioritne sa riaď tepom. Ak nie, riaď sa pocitom."}
        </div>
      )}

      <div className={PLAN_STRUCT_STACK}>
        {wu && (
          <div className={PLAN_BLOCK}>
            <div className={PLAN_BLOCK_LABEL}>{t("sessions.detail.plan.warmup")}</div>
            <div className={PLAN_BLOCK_TEXT}>
              {typeof wu === "string" ? wu : getDuration(wu, locale) || "—"}
            </div>
            {showAdvanced && typeof wu !== "string" && getNote(wu) && (
              <div className={PLAN_MAIN_NOTE + " mt-1 animate-in fade-in"}>
                {safeText(getNote(wu))}
              </div>
            )}
          </div>
        )}

        {mainBlocks.length > 0 && (
          <div className={PLAN_BLOCK}>
            <div className={PLAN_BLOCK_LABEL}>{t("sessions.detail.plan.main")}</div>
            <div className={PLAN_MAIN_STACK}>
              {mainBlocks.map((blk: any, idx: number) => {
                if (typeof blk === "string") {
                  return (
                    <div key={idx} className={PLAN_MAIN_ITEM} style={PLAN_MAIN_ITEM_STYLE}>
                      <div className={PLAN_MAIN_NOTE}>{safeText(blk)}</div>
                    </div>
                  );
                }

                const isIntervalFlat = blk.kind === "interval_block";
                const isIntervalNested = !!blk.interval_block;
                const isInterval = isIntervalFlat || isIntervalNested;

                if (isInterval) {
                  const iData = isIntervalNested ? blk.interval_block : blk;
                  // AI generuje niekedy 'repeats', niekedy 'rounds'
                  const reps = iData.repeats ?? iData.rounds ?? 1;

                  // Nested: intervals[0] = work, intervals[1] = rest
                  // Flat: work / rest priamo
                  const workBlock = isIntervalNested
                    ? (iData.intervals?.[0] ?? iData.work ?? null)
                    : iData.work;
                  const restBlock = isIntervalNested
                    ? (iData.intervals?.[1] ?? iData.rest ?? null)
                    : iData.rest;

                  const workDur = getDuration(workBlock, locale);
                  const restDur = getDuration(restBlock, locale);
                  const workNote = getNote(workBlock);
                  const restNote = getNote(restBlock);

                  return (
                    <div key={idx} className={PLAN_MAIN_ITEM} style={PLAN_MAIN_ITEM_STYLE}>
                      <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5 mb-1">
                        <span className="text-white font-bold text-base">{reps}×</span>
                        <span className="opacity-90">
                          {workDur || "—"}{" "}
                          {showAdvanced && (
                            <span className="opacity-60 text-xs">
                              ({t("sessions.detail.plan.work")})
                            </span>
                          )}
                        </span>
                        {restDur && (
                          <span className="opacity-60">
                            + {restDur}{" "}
                            {showAdvanced && (
                              <span className="text-xs">
                                ({t("sessions.detail.plan.recovery")})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      {showAdvanced && workNote && (
                        <div className={PLAN_MAIN_NOTE + " mt-1 animate-in fade-in"}>
                          {safeText(workNote)}
                        </div>
                      )}
                      {showAdvanced && restDur && restNote && (
                        <div className={PLAN_MAIN_NOTE + " mt-1 opacity-70 animate-in fade-in"}>
                          {t("sessions.detail.plan.recovery")}: {safeText(restNote)}
                        </div>
                      )}
                    </div>
                  );
                }

                // --- SIMPLE BLOCK ---
                const dur = getDuration(blk, locale);
                const note = getNote(blk);

                return (
                  <div key={idx} className={PLAN_MAIN_ITEM} style={PLAN_MAIN_ITEM_STYLE}>
                    <div className="font-semibold text-white/90">{dur || "—"}</div>
                    {showAdvanced && note && (
                      <div className={PLAN_MAIN_NOTE + " mt-1 animate-in fade-in"}>
                        {safeText(note)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {cd && (
          <div className={PLAN_BLOCK}>
            <div className={PLAN_BLOCK_LABEL}>{t("sessions.detail.plan.cooldown")}</div>
            <div className={PLAN_BLOCK_TEXT}>
              {typeof cd === "string" ? cd : getDuration(cd, locale) || "—"}
            </div>
            {showAdvanced && typeof cd !== "string" && getNote(cd) && (
              <div className={PLAN_MAIN_NOTE + " mt-1 animate-in fade-in"}>
                {safeText(getNote(cd))}
              </div>
            )}
          </div>
        )}
      </div>
    </ActivitySectionShell>
  );
}
