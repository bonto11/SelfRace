"use client";

import { useMemo, useState, useEffect } from "react";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField"; 
import SelectField from "@/app/shared/ui/components/SelectField"; 
import type { DayAbbrev } from "@/app/shared/types/day";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";
import { useUserId } from "@/app/shared/hooks/useUserId";

// Import pre zistenie statického profilu (aby sme vedeli, či je to žena)
import { apiGetStaticProfile } from "@/app/features/performance/api/static";

const ALL_DAYS: DayAbbrev[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type WomensHealth = {
  sync_enabled: boolean;
  cycle_length_days?: number;
  next_cycle_start?: string | null;
};

type Props = {
  daysOff: DayAbbrev[] | undefined;
  longRunDays: DayAbbrev[] | undefined;
  womensHealth?: WomensHealth; 
  toggleInArray: <T>(arr: T[] | undefined, v: T) => T[];
  setPrefNested: (
    path: "preferences.days_off" | "preferences.long_run_days" | "preferences.womens_health",
    v: any,
  ) => void;
};

// Možnosti pre SelectField (od 20 do 45 dní)
const CYCLE_LENGTH_OPTIONS = Array.from({ length: 26 }, (_, i) => ({
  value: String(i + 20),
  label: `${i + 20} dní`
}));

export function DaysSection({
  daysOff,
  longRunDays,
  womensHealth,
  toggleInArray,
  setPrefNested,
}: Props) {
  const { userId } = useUserId();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [isFemale, setIsFemale] = useState(false);

  // Načítanie pohlavia pri zobrazení komponentu
  useEffect(() => {
    if (!userId) return;
    
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const staticProfile = await apiGetStaticProfile(userId);
        if (isMounted && staticProfile?.sex?.toUpperCase() === "F") {
          setIsFemale(true);
        }
      } catch (e) {
        // Ignorujeme, ak sa nepodarí načítať
      }
    };
    
    fetchProfile();
    return () => { isMounted = false; };
  }, [userId]);

  const selectedOff = (daysOff ?? []) as DayAbbrev[];
  const selectedLong = (longRunDays ?? []) as DayAbbrev[];
  
  const healthData = womensHealth || { sync_enabled: false, cycle_length_days: 28, next_cycle_start: "" };

  const getDayLabel = (d: DayAbbrev) => {
    const key = d.toLowerCase() as keyof typeof t;
    return t(`common.weeksShort.${key}`);
  };

  const previewText = useMemo(() => {
    const noneTxt = t("common.none") || "žiadne";
    const offTxt = selectedOff.length 
      ? selectedOff.map(getDayLabel).join(" · ") 
      : noneTxt;
    const longTxt = selectedLong.length 
      ? selectedLong.map(getDayLabel).join(" · ") 
      : noneTxt;
      
    let preview = `${t("prefs.sections.daysSection.previewDaysOff")}: ${offTxt} | ${t("prefs.sections.daysSection.previewLongRun")}: ${longTxt}`;
    
    if (isFemale && healthData.sync_enabled) {
      preview += " | 🌸 AI Cyklus: Zapnutý";
    }
    
    return preview;
  }, [selectedOff, selectedLong, isFemale, healthData.sync_enabled, t]);

  const updateWomensHealth = (patch: Partial<WomensHealth>) => {
    setPrefNested("preferences.womens_health", { ...healthData, ...patch });
  };

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>{t("prefs.sections.daysSection.widget.title")}</span>
          <TooltipIcon text={t("prefs.sections.daysSection.widget.tooltip")} />
        </div>
      }
      subtitle={
        <span style={{ color: appColors.textMuted }}>
          {t("prefs.sections.daysSection.subtitle")}
        </span>
      }
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        
        {/* === SEKCIA: ŽENSKÉ ZDRAVIE === */}
        {isFemale && (
          <div className={`rounded-xl border p-4 ${healthData.sync_enabled ? "bg-pink-500/10 border-pink-500/40" : "bg-white/5 border-white/10"}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col pr-3">
                <span className={`text-sm font-bold ${healthData.sync_enabled ? "text-pink-400" : "text-white/90"}`}>
                  🌸 Ženské zdravie
                </span>
                <span className="text-[11px] opacity-70 mt-1">
                  Zohľadňovať menštruačný cyklus pri plánovaní. AI automaticky naplánuje Taper (oddychový) týždeň počas tvojich dní.
                </span>
              </div>
              <input
                type="checkbox"
                className="checkbox checkbox-sm border-white/20 checked:border-pink-500 checked:bg-pink-500 [--chkbg:theme(colors.pink.500)] [--chkfg:white] shrink-0"
                checked={healthData.sync_enabled}
                onChange={(e) => updateWomensHealth({ sync_enabled: e.target.checked })}
              />
            </div>

            {/* Správne zarovnané prvky pod seba na mobile (flex-col), vedľa seba na PC (sm:flex-row) */}
            {healthData.sync_enabled && (
              <div className="flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t border-pink-500/20">
                <div className="flex-1 min-w-0 bg-black/30 rounded-md">
                  <SelectField
                    label="Dĺžka cyklu"
                    options={CYCLE_LENGTH_OPTIONS}
                    value={String(healthData.cycle_length_days ?? 28)}
                    onChange={(e: any) => updateWomensHealth({ cycle_length_days: parseInt(e.target.value) || 28 })}
                  />
                </div>
                
                <div className="flex-1 min-w-0 bg-black/30 rounded-md">
                  <TextField
                    label="Začiatok (Odhad)"
                    type="date"
                    value={healthData.next_cycle_start ?? ""}
                    onChange={(e: any) => updateWomensHealth({ next_cycle_start: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* === Pôvodné: Days off === */}
        <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium opacity-80">
              {t("prefs.sections.daysSection.daysOffLabel")}
            </div>
            <div className="text-[11px] opacity-60">
              {selectedOff.length 
                ? selectedOff.map(getDayLabel).join(" · ") 
                : t("common.none")}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {ALL_DAYS.map((d) => {
              const active = selectedOff.includes(d);
              const next = toggleInArray(selectedOff, d) as DayAbbrev[];
              return (
                <Button
                  key={`off_${d}`}
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={active}
                  onClick={() => setPrefNested("preferences.days_off", next)}
                >
                  {getDayLabel(d)}
                </Button>
              );
            })}
          </div>

          <div className="text-[11px] opacity-60 mt-2">
            {t("prefs.sections.daysSection.daysOffHint")}
          </div>
        </div>

        {/* === Pôvodné: Long run days === */}
        <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium opacity-80">
              {t("prefs.sections.daysSection.longRunLabel")}
            </div>
            <div className="text-[11px] opacity-60">
              {selectedLong.length 
                ? selectedLong.map(getDayLabel).join(" · ") 
                : t("common.none")}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {ALL_DAYS.map((d) => {
              const active = selectedLong.includes(d);
              const next = toggleInArray(selectedLong, d) as DayAbbrev[];
              return (
                <Button
                  key={`long_${d}`}
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={active}
                  onClick={() =>
                    setPrefNested("preferences.long_run_days", next)
                  }
                >
                  {getDayLabel(d)}
                </Button>
              );
            })}
          </div>

          <div className="text-[11px] opacity-60 mt-2">
            {t("prefs.sections.daysSection.longRunHint")}
          </div>
        </div>
      </div>
    </InputsCard>
  );
}
