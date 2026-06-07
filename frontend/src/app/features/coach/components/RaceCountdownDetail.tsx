// src/app/features/coach/components/RaceCountdownDetail.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiFetchUserPref, apiUpsertUserPref } from "@/app/features/prefs/api/prefs";
import { normalizeCoachPrefs } from "@/app/features/prefs/utils/prefs";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import SelectField from "@/app/shared/ui/components/SelectField";
import DateField from "@/app/shared/ui/components/DateField";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

const PRIORITIES = ["A", "B", "C"] as const;
const RACE_GOALS = ["5k", "10k", "half", "marathon", "ultra", "other"] as const;
const RACE_TYPES = ["road", "trail", "track", "cross", "ocr", "hyrox", "other"] as const;

function makeId() {
  return `race_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
function emptyRace() {
  return { id: makeId(), name: "", date: null, priority: null, race_goal: null, race_type: null };
}
function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const race = new Date(dateStr); race.setHours(0, 0, 0, 0);
  return Math.round((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/* ─── RACE CARD ─── */
function RaceCard({ race, index, onChange, onRemove, t }: {
  race: any; index: number;
  onChange: (patch: any) => void;
  onRemove: () => void;
  t: any;
}) {
  const days = race.date ? daysUntil(race.date) : null;

  return (
    <div style={{
      borderRadius: 12, border: `1px solid ${appColors.panelBorder}`,
      padding: "12px 14px", backgroundColor: "rgba(255,255,255,0.03)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Header: priorita + countdown + remove */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: appColors.textMuted }}>
          {t("prefs.sections.goalSection.priorityLabel")} {index + 1}
        </span>
        {days !== null && (
          <span style={{
            marginLeft: "auto", fontSize: 12, fontWeight: 700,
            color: days <= 7 ? appColors.stateDanger : days <= 21 ? appColors.stateWarning : "#4ade80",
          }}>
            {days} {t("common.units.days") as string || "dní"}
          </span>
        )}
        <Button size="xs" variant="danger" onClick={onRemove}>
          {t("prefs.sections.goalSection.removeBtn")}
        </Button>
      </div>

      {/* Názov */}
      <TextField
        label={t("prefs.sections.goalSection.raceNameLabel").replace("{{index}}", String(index + 1))}
        placeholder={t("prefs.sections.goalSection.raceNamePlaceholder")}
        value={race.name ?? ""}
        onChange={(e) => onChange({ name: e.currentTarget.value || null })}
      />

      {/* Dátum + Priorita + Cieľ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: appColors.textMuted, marginBottom: 4 }}>
            {t("prefs.sections.goalSection.dateLabel")}
          </div>
          <DateField
            value={race.date ?? null}
            onChange={(v) => onChange({ date: v || null })}
            variant="editable"
          />
        </div>

        <SelectField
          label={t("prefs.sections.goalSection.priorityLabel")}
          value={race.priority ?? ""}
          onValueChange={(v) => onChange({ priority: v || null })}
          options={[
            { value: "", label: "—" },
            ...PRIORITIES.map((p) => ({ value: p, label: p })),
          ]}
          variant="editable"
        />

        <SelectField
          label={t("prefs.sections.goalSection.targetDistLabel")}
          value={race.race_goal ?? ""}
          onValueChange={(v) => onChange({ race_goal: v || null })}
          options={[
            { value: "", label: "—" },
            ...RACE_GOALS.map((g) => ({
              value: g,
              label: (t as any)(`prefs.sections.goalSection.enums.race.${g}`) || g,
            })),
          ]}
          variant="editable"
        />
      </div>

      {/* Typ pretekov */}
      <SelectField
        label={t("prefs.sections.goalSection.raceTypeLabel")}
        value={race.race_type ?? ""}
        onValueChange={(v) => onChange({ race_type: v || null })}
        options={[
          { value: "", label: "—" },
          ...RACE_TYPES.map((rt) => ({
            value: rt,
            label: (t as any)(`prefs.sections.goalSection.enums.type.${rt}`) || rt,
          })),
        ]}
        variant="editable"
      />
    </div>
  );
}

/* ─── HLAVNÝ KOMPONENT ─── */
export default function RaceCountdownDetail() {
  const { userId } = useUserId();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<any>(null);
  const [races, setRaces] = useState<any[]>([]);

  // Načítaj prefs
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const raw = await apiFetchUserPref(userId, "coach.prefs");
        if (!alive) return;
        const normalized = normalizeCoachPrefs(raw);
        setPrefs(normalized);
        setRaces(Array.isArray(normalized?.targets?.run?.races)
          ? normalized.targets.run.races : []);
      } catch (e) {
        console.error("[RaceCountdownDetail] load error", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const updateRaceAt = useCallback((index: number, patch: any) => {
    setRaces((prev) => prev.map((r, i) => i === index ? { ...r, ...patch } : r));
  }, []);

  const addRace = useCallback(() => {
    setRaces((prev) => [...prev, emptyRace()]);
  }, []);

  const removeRace = useCallback((index: number) => {
    setRaces((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const updated = {
        ...prefs,
        targets: {
          ...(prefs?.targets ?? {}),
          run: {
            ...(prefs?.targets?.run ?? {}),
            races,
            // Sync hlavné preteky (A priorita)
            ...((() => {
              const main = races.find((r) => r.priority === "A") ?? races[0];
              if (!main) return {};
              return {
                race_goal: main.race_goal ?? null,
                race_type: main.race_type ?? null,
              };
            })()),
          },
        },
      };
      await apiUpsertUserPref(userId, "coach.prefs", updated);
      setPrefs(updated);
      toast.success(t("common.done"));
    } catch (e) {
      toast.error(t("api.prefs.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <LoadingSpinner size="trend" />
    </div>
  );

  // Zoraď preteky podľa dátumu pre zobrazenie
  const sorted = [...races].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <>
      {/* Zoznam pretekov */}
      <section className={CARD} style={SURFACE_CARD_STYLE}>
        <div style={{ padding: "14px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: appColors.textPrimary }}>
              {t("prefs.sections.goalSection.racesTitle")}
            </div>
            <div style={{ fontSize: 12, color: appColors.textMuted, marginTop: 2 }}>
              {t("prefs.sections.goalSection.subtitle")}
            </div>
          </div>
          <Button size="xs" variant="success" onClick={addRace}>
            {t("prefs.sections.goalSection.addBtn")}
          </Button>
        </div>

        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          {races.length === 0 ? (
            <p style={{ fontSize: 13, color: appColors.textMuted, padding: "8px 4px" }}>
              {t("prefs.sections.goalSection.noRaces")}
            </p>
          ) : (
            sorted.map((race, i) => {
              const origIndex = races.findIndex((r) => r.id === race.id);
              return (
                <RaceCard
                  key={race.id ?? i}
                  race={race}
                  index={origIndex}
                  onChange={(patch) => updateRaceAt(origIndex, patch)}
                  onRemove={() => removeRace(origIndex)}
                  t={t}
                />
              );
            })
          )}
        </div>
      </section>

      {/* Uložiť */}
      <div style={{ padding: "12px 0" }}>
        <Button
          variant="primary"
          onClick={onSave}
          disabled={saving}
          style={{ width: "100%" }}
        >
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </>
  );
}
