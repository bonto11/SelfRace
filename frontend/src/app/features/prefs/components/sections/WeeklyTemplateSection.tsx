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

// sport "" = žiadny pevný tréning v daný deň
const SPORT_OPTIONS: { value: TemplateSportKind | ""; label: string }[] = [
  { value: "", label: "— žiadny fixný tréning —" },
  { value: "run", label: "Beh" },
  { value: "ride", label: "Bicykel" },
  { value: "swim", label: "Plávanie" },
  { value: "strength", label: "Sila" },
  { value: "other", label: "Iné" },
];

const MAX_FIXED_SLOTS = 3;

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
  const templateEnabled = mode !== "off";

  const fixedCount = useMemo(() => {
    return (template.days ?? []).reduce((acc, d) => {
      const slots = d.slots ?? [];
      const nonEmpty = slots.filter((s) => s && s.sport && s.kind).length;
      return acc + nonEmpty;
    }, 0);
  }, [template]);

  const summary = useMemo(() => {
    if (!templateEnabled) {
      return "Vypnuté – coach si rozloží týždeň podľa cieľov a histórie.";
    }
    const parts: string[] = [];
    for (const d of DAY_ORDER) {
      const dayT = template.days.find((x) => x.day === d.value);
      if (!dayT || !dayT.slots.length) continue;
      const slot = dayT.slots[0];
      if (!slot || !slot.sport || !slot.kind) continue;
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
      return "Zapnuté, ale nemáš zvolené žiadne fixné tréningy.";
    }
    return parts.join(" · ");
  }, [templateEnabled, template]);

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

    const cleanedSlots = (nextDay.slots ?? []).filter(
      (s) => s && s.sport && s.kind
    );
    const finalDays =
      cleanedSlots.length === 0
        ? other
        : [...other, { ...nextDay, slots: cleanedSlots }];

    updateTemplate({ days: finalDays });
  };

  /**
   * Jednoduchý model:
   * - max 1 slot na deň
   * - každý slot je automaticky priority = "key", ai_can_move = false
   */
  const updateSingleSlot = (
    day: DayAbbrev,
    patch: Partial<SessionTemplate>
  ) => {
    const currentDay = ensureDay(template, day);
    const prev = (currentDay.slots?.[0] ?? {}) as SessionTemplate;

    const merged: SessionTemplate = {
      ...prev,
      ...patch,
    };

    const sport = (merged as any).sport as TemplateSportKind | "" | undefined;
    const kind = (merged as any).kind as
      | RunTemplateKind
      | StrengthTemplateKind
      | "other"
      | ""
      | undefined;

    // ak nemáme sport alebo kind → žiadny fixný tréning v tento deň
    if (!sport && !kind) {
      updateDay(day, { slots: [] });
      return;
    }

    // v jednoduchom modeli sú všetky tieto sloty "key" a pevné
    merged.priority = "key" as any;
    (merged as any).ai_can_move = false;

    updateDay(day, { slots: [merged] });
  };

  const handleToggleEnabled = (enabled: boolean) => {
    if (!enabled) {
      updateTemplate({ mode: "off", days: [] });
    } else {
      // "loose" tu používame len ako "zapnuté";
      // BE používa priority+ai_can_move, nie mode.
      updateTemplate({
        mode: "loose",
        days: template.days ?? [],
      });
    }
  };

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Fixné tréningy v týždni (advanced)
        </div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Tu si vieš zafixovať max. pár kľúčových tréningov v konkrétnych dňoch (napr. štvrtkové intervaly, sobotný long run). Coach potom doplní ostatné tréningy okolo nich podľa cieľov, objemu a regenerácie." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Skryť nastavenia"
            labelWhenClosed="Zobraziť nastavenia"
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
          <div
            className={[
              SURFACE_INLINE,
              "px-3 py-2 text-xs leading-relaxed opacity-80 flex flex-col gap-2",
            ].join(" ")}
          >
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={templateEnabled}
                onChange={(e) => handleToggleEnabled(e.target.checked)}
              />
              <span>Použiť fixné tréningy v týždni (max {MAX_FIXED_SLOTS})</span>
            </label>
            <div>
              Keď je táto možnosť vypnutá, coach si celý týždeň rozloží sám
              podľa cieľov, pretekov a histórie. Keď ju zapneš, vyberieš si max{" "}
              {MAX_FIXED_SLOTS} kľúčových tréningov (napr. štvrtkový
              intervalový beh, sobotný long run) a coach naplánuje zvyšok okolo
              nich.
            </div>
            {templateEnabled && fixedCount >= MAX_FIXED_SLOTS && (
              <div className="text-[11px] text-red-500">
                Dosiahol si limit {MAX_FIXED_SLOTS} fixných tréningov za týždeň.
                Ak chceš pridať ďalší, najprv niektorý iný odstráň.
              </div>
            )}
          </div>

          {templateEnabled && (
            <div className="space-y-2">
              {DAY_ORDER.map((d) => {
                const dayT = ensureDay(template, d.value);
                const slot = (dayT.slots?.[0] ?? {}) as SessionTemplate;

                const sport = (slot?.sport ??
                  "") as TemplateSportKind | "";
                const kind = (slot?.kind ?? "") as any;

                const kindOpts = kindOptionsForSport(sport);

                const hasSlot = !!sport && !!kind;
                const disableNewSlot =
                  !hasSlot && fixedCount >= MAX_FIXED_SLOTS;

                return (
                  <div key={d.value} className={SURFACE_INLINE + " p-3"}>
                    <div className="text-xs font-medium mb-2 opacity-80">
                      {d.label}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1.4fr] gap-2 items-center">
                      <SelectField
                        value={sport}
                        onChange={(e) =>
                          updateSingleSlot(d.value, {
                            // "" = žiadny fixný tréning v tento deň
                            sport: e.target.value as TemplateSportKind,
                            // keď zmeníš sport, zresetuješ kind
                            kind: "" as any,
                          })
                        }
                        options={SPORT_OPTIONS}
                        disabled={disableNewSlot}
                      />
                      <SelectField
                        value={kind}
                        onChange={(e) =>
                          updateSingleSlot(d.value, {
                            kind: e.target.value as any,
                          })
                        }
                        options={kindOpts}
                        disabled={disableNewSlot || !sport}
                      />
                    </div>
                    {disableNewSlot && !hasSlot && (
                      <div className="mt-1 text-[11px] text-red-500">
                        Máš už nastavené {MAX_FIXED_SLOTS} fixné tréningy v
                        týždni. Najprv niektorý inde vypni.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!templateEnabled && (
            <div
              className={[
                SURFACE_INLINE,
                "px-3 py-2 text-xs leading-relaxed opacity-80",
              ].join(" ")}
            >
              Fixné tréningy sú vypnuté. Coach bude sám rozhodovať, v ktoré dni
              dať long run, rýchlostný tréning, silu a podobne. Ak chceš mať
              napr. „štvrtok vždy intervaly“ alebo „sobota vždy long run“,
              zapni fixné tréningy a vyber si konkrétne dni.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default WeeklyTemplateSection;