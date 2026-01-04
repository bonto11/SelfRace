"use client";

import { useMemo, useState } from "react";
import SelectField from "@/app/shared/components/ui/SelectField";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";
import { SECTION, SURFACE_INLINE } from "@/app/shared/ui/classes";
import type {
  WeeklyTemplate,
  DayTemplate,
  SessionTemplate,
  WeeklyTemplateMode,
  TemplateSportKind,
  RunTemplateKind,
  StrengthTemplateKind,
  SessionPriority,
} from "@/app/features/prefs/types/prefs";
import type { DayAbbrev } from "@/app/shared/types/day";

type Props = {
  template: WeeklyTemplate;
  onChange: (next: WeeklyTemplate) => void;
};

const DAY_ORDER: { value: DayAbbrev; label: string }[] = [
  { value: "Mon", label: "Pondelok" },
  { value: "Tue", label: "Utorok" },
  { value: "Wed", label: "Streda" },
  { value: "Thu", label: "Štvrtok" },
  { value: "Fri", label: "Piatok" },
  { value: "Sat", label: "Sobota" },
  { value: "Sun", label: "Nedeľa" },
];

const SPORT_OPTIONS: { value: TemplateSportKind | ""; label: string }[] = [
  { value: "", label: "— žiadny tréning —" },
  { value: "run", label: "Beh" },
  { value: "ride", label: "Bicykel" },
  { value: "swim", label: "Plávanie" },
  { value: "strength", label: "Sila" },
  { value: "other", label: "Iné" },
];

const PRIORITY_OPTIONS: { value: SessionPriority; label: string }[] = [
  { value: "key", label: "Kľúčový tréning" },
  { value: "support", label: "Podporný" },
  { value: "optional", label: "Voliteľný" },
];

const MODE_OPTIONS: { value: WeeklyTemplateMode; label: string }[] = [
  { value: "off", label: "Vypnuté – coach určuje rozloženie" },
  {
    value: "loose",
    label: "Loose – coach rešpektuje, ale môže mierne pohnúť",
  },
  {
    value: "strict",
    label: "Strict – coach zachová štruktúru (typ tréningu/deň)",
  },
];

function kindOptionsForSport(sport: TemplateSportKind | ""): {
  value: RunTemplateKind | StrengthTemplateKind | "other" | "";
  label: string;
}[] {
  if (!sport) return [{ value: "", label: "— typ tréningu —" }];

  if (sport === "run") {
    return [
      { value: "", label: "— typ behu —" },
      { value: "easy", label: "Easy / Z2" },
      { value: "long", label: "Long run" },
      { value: "tempo", label: "Tempo" },
      { value: "threshold", label: "Threshold" },
      { value: "intervals", label: "Intervaly" },
      { value: "vo2max", label: "VO2max / rýchlosť" },
      { value: "hills", label: "Kopce" },
      { value: "recovery", label: "Recovery beh" },
    ];
  }

  if (sport === "strength") {
    return [
      { value: "", label: "— typ sily —" },
      { value: "full", label: "Full body" },
      { value: "upper", label: "Upper body" },
      { value: "lower", label: "Lower body" },
      { value: "core", label: "Core" },
      { value: "hiit", label: "HIIT / Tabata" },
    ];
  }

  return [
    { value: "", label: "— typ tréningu —" },
    { value: "endurance" as any, label: "Vytrvalosť" },
    { value: "technique" as any, label: "Technika" },
    { value: "other", label: "Iné" },
  ];
}

function ensureDay(template: WeeklyTemplate, day: DayAbbrev): DayTemplate {
  const existing = template.days.find((d) => d.day === day);
  if (existing) return existing;
  return { day, slots: [] };
}

export function WeeklyTemplateSection({ template, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const mode = (template.mode ?? "off") as WeeklyTemplateMode;

  const summary = useMemo(() => {
    if (mode === "off") {
      return "Vypnuté – coach si rozloží týždeň podľa cieľov a histórie.";
    }
    const parts: string[] = [];
    for (const d of DAY_ORDER) {
      const dayT = template.days.find((x) => x.day === d.value);
      if (!dayT || !dayT.slots.length) continue;
      const slot = dayT.slots[0];
      const sportLabel =
        SPORT_OPTIONS.find((s) => s.value === slot.sport)?.label ?? "Tréning";
      const kindLabel =
        kindOptionsForSport(slot.sport).find((k) => k.value === slot.kind)
          ?.label ?? "";
      parts.push(
        `${d.label}: ${sportLabel}${kindLabel ? " – " + kindLabel : ""}`
      );
    }
    if (!parts.length) {
      return "Zapnuté, ale žiadne dni ešte nemajú tréning.";
    }
    return parts.join(" · ");
  }, [mode, template]);

  const updateTemplate = (patch: Partial<WeeklyTemplate>) => {
    onChange({
      ...template,
      ...patch,
    });
  };

  const updateDay = (day: DayAbbrev, patch: Partial<DayTemplate>) => {
    const current = ensureDay(template, day);
    const other = template.days.filter((d) => d.day !== day);
    const nextDay: DayTemplate = { ...current, ...patch };

    // ak deň nemá žiadne sloty, vôbec ho neukladaj
    const cleanedSlots = (nextDay.slots ?? []).filter(
      (s) => s && s.sport && s.kind
    );
    const finalDays =
      cleanedSlots.length === 0
        ? other
        : [...other, { ...nextDay, slots: cleanedSlots }];

    updateTemplate({ days: finalDays });
  };

  const updateSlot = (
    day: DayAbbrev,
    idx: number,
    patch: Partial<SessionTemplate>
  ) => {
    const currentDay = ensureDay(template, day);
    const slots = [...(currentDay.slots ?? [])];

    while (slots.length <= idx) slots.push({} as SessionTemplate);

    const prev = (slots[idx] ?? {}) as SessionTemplate;

    // najprv pôvodný slot + patch
    const merged: SessionTemplate = {
      ...prev,
      ...patch,
    };

    // doplnenie defaultov – ŽIADNE duplikáty v literáli
    if (!merged.sport) {
      merged.sport = "run" as TemplateSportKind;
    }
    if (!merged.kind) {
      merged.kind = "easy" as any;
    }
    if (!merged.priority) {
      merged.priority = "support";
    }
    if (typeof merged.ai_can_move !== "boolean") {
      merged.ai_can_move = template.mode !== "strict";
    }

    // ak po zmene nemá sport ani kind -> vymaž slot
    if (!merged.sport && !merged.kind) {
      slots.splice(idx, 1);
    } else {
      slots[idx] = merged;
    }

    updateDay(day, { slots });
  };

  const handleModeChange = (nextMode: WeeklyTemplateMode) => {
    updateTemplate({ mode: nextMode });
  };

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Weekly template (advanced)
        </div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Tu si vieš napevno rozložiť, v ktoré dni chceš aký typ tréningu. Coach potom rieši objem a intenzitu, ale drží sa tvojej štruktúry (najmä v režime Strict)." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Skryť template"
            labelWhenClosed="Zobraziť template"
          />
        </div>
      </div>

      {!open && (
        <div
          className={[SURFACE_INLINE, "px-3 py-2 text-xs opacity-80"].join(" ")}
        >
          {summary}
        </div>
      )}

      {open && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs opacity-80 mb-1">Režim</div>
              <SelectField
                value={mode}
                onChange={(e) =>
                  handleModeChange(e.target.value as WeeklyTemplateMode)
                }
                options={MODE_OPTIONS}
              />
            </div>
            <div
              className={[
                SURFACE_INLINE,
                "px-3 py-2 text-xs leading-relaxed opacity-80",
              ].join(" ")}
            >
              {mode === "off" &&
                "Vypnuté – coach si sám rozhoduje, kedy dať long run, rýchlosť atď."}
              {mode === "loose" &&
                "Loose – týždeň si navrhneš ty, coach sa ho snaží držať, ale môže jemne posunúť tréning kvôli regenerácii."}
              {mode === "strict" &&
                "Strict – coach zachová tvoje rozloženie (typy tréningov v konkrétnych dňoch), ale môže upraviť objem/intenzitu, ak je toho príliš."}
            </div>
          </div>

          <div className="space-y-2">
            {DAY_ORDER.map((d) => {
              const dayT = ensureDay(template, d.value);
              const slots = dayT.slots ?? [];
              const slot0 = slots[0] ?? ({} as SessionTemplate);
              const slot1 = slots[1] ?? ({} as SessionTemplate);

              const renderSlot = (idx: number, slot: SessionTemplate) => {
                const sport = (slot?.sport ?? "") as TemplateSportKind | "";
                const kind = (slot?.kind ?? "") as any;
                const priority = (slot?.priority ??
                  "support") as SessionPriority;
                const aiCanMove =
                  slot?.ai_can_move ??
                  (template.mode !== "strict" ? true : false);

                const kindOpts = kindOptionsForSport(sport);

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1.2fr_0.9fr_auto] gap-2">
                    <SelectField
                      value={sport}
                      onChange={(e) =>
                        updateSlot(d.value, idx, {
                          sport: e.target.value as TemplateSportKind,
                          // keď zmeníš sport, zresetuj kind
                          kind: "" as any,
                        })
                      }
                      options={SPORT_OPTIONS}
                    />
                    <SelectField
                      value={kind}
                      onChange={(e) =>
                        updateSlot(d.value, idx, {
                          kind: e.target.value as any,
                        })
                      }
                      options={kindOpts}
                    />
                    <SelectField
                      value={priority}
                      onChange={(e) =>
                        updateSlot(d.value, idx, {
                          priority: e.target.value as SessionPriority,
                        })
                      }
                      options={PRIORITY_OPTIONS}
                    />
                    <label className="flex items-center gap-1 text-[11px] opacity-80">
                      <input
                        type="checkbox"
                        checked={!!aiCanMove}
                        onChange={(e) =>
                          updateSlot(d.value, idx, {
                            ai_can_move: e.target.checked,
                          })
                        }
                      />
                      <span>AI môže presunúť</span>
                    </label>
                  </div>
                );
              };

              return (
                <div key={d.value} className={SURFACE_INLINE + " p-3"}>
                  <div className="text-xs font-medium mb-2 opacity-80">
                    {d.label}
                  </div>
                  <div className="space-y-2">
                    {renderSlot(0, slot0)}
                    {/* druhý slot – voliteľný */}
                    {renderSlot(1, slot1)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default WeeklyTemplateSection;
