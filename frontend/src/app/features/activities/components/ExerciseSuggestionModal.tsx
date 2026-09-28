// src/app/features/activities/components/ExerciseSuggestionModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import SelectField from "@/app/shared/ui/components/SelectField";
import { toast } from "@/app/shared/ui/components/Toast";
import { apiSuggestExercise } from "@/app/features/activities/api/exercise_suggestions";

const PATTERN_OPTIONS = [
  "squat", "hinge", "lunge", "push_h", "push_v", "pull_h", "pull_v",
  "carry", "grip", "rotation", "anti_rotation", "calf", "jump", "anti_extension", "other",
] as const;

const EQUIPMENT_OPTIONS = [
  "none", "dumbbells", "barbell", "kettlebell", "trx", "pullup_bar",
  "resistance_bands", "bench", "medicine_ball", "sandbag", "box", "abwheel", "other",
] as const;

export default function ExerciseSuggestionModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { userId } = useUserId();

  const [name, setName] = useState("");
  const [pattern, setPattern] = useState<string>("other");
  const [loadMode, setLoadMode] = useState<"external" | "bodyweight_plus">("external");
  const [measure, setMeasure] = useState<"reps" | "time" | "distance">("reps");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 🌟 FIX: na mobile modal žije v position:fixed mimo bežného scroll flow
  // stránky, takže keď sa otvorí klávesnica, systém nevie sám posunúť
  // obsah tak, aby bolo fokusnuté pole vidno (fungovalo by to, len keby
  // bol input súčasťou normálne scrollovanej stránky). Namiesto toho
  // počúvame focusin v rámci vlastného scroll kontajnera a fokusnuté pole
  // scrollneme ručne - s malým oneskorením, kým sa klávesnica doanimuje.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !container.contains(target)) return;
      window.setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 300);
    };

    container.addEventListener("focusin", onFocusIn);
    return () => container.removeEventListener("focusin", onFocusIn);
  }, []);

  const toggleEquipment = (key: string) =>
    setEquipment((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleSubmit = async () => {
    if (!userId || !name.trim() || submitting) return;
    setSubmitting(true);
    const ok = await apiSuggestExercise(Number(userId), {
      name: name.trim(),
      pattern,
      load_mode: loadMode,
      measure,
      equipment,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (ok) {
      toast.success(t("strengthLog.suggestSuccess"));
      onClose();
    } else {
      toast.error(t("strengthLog.suggestError"));
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/60 p-3"
      style={{ zIndex: 2147483000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-md rounded-2xl bg-[#0d1a12] border border-white/10 flex flex-col max-h-[85dvh]"
        style={{ overscrollBehavior: "contain" }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 shrink-0">
          <div className="text-sm font-semibold">{t("strengthLog.suggestExerciseTitle")}</div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 shrink-0 rounded text-lg opacity-60 hover:opacity-100 transition-opacity"
            aria-label={t("common.cancel")}
          >
            ×
          </button>
        </div>

        <div
          ref={scrollRef}
          className="flex flex-col gap-3 p-4 overflow-y-auto"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
        >
          <TextField
            label={t("strengthLog.suggestNameLabel")}
            value={name}
            maxLength={100}
            placeholder={t("strengthLog.suggestNamePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />

          <SelectField
            label={t("strengthLog.suggestPatternLabel")}
            value={pattern}
            onValueChange={setPattern}
            options={PATTERN_OPTIONS.map((p) => ({ value: p, label: t(`strengthLog.patterns.${p}` as any) }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label={t("strengthLog.suggestLoadModeLabel")}
              value={loadMode}
              onValueChange={(v) => setLoadMode(v as any)}
              options={[
                { value: "external", label: t("strengthLog.unitWeight") || "Kg" },
                { value: "bodyweight_plus", label: t("strengthLog.unitExtraWeight") || "+kg" },
              ]}
            />
            <SelectField
              label={t("strengthLog.suggestMeasureLabel")}
              value={measure}
              onValueChange={(v) => setMeasure(v as any)}
              options={[
                { value: "reps", label: t("strengthLog.repsShort") || "Opakovania" },
                { value: "time", label: t("strengthLog.unitSeconds") || "Sekundy" },
                { value: "distance", label: t("strengthLog.unitMeters") || "Metre" },
              ]}
            />
          </div>

          <div>
            <div className="text-xs opacity-60 mb-1">{t("strengthLog.suggestEquipmentLabel")}</div>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={equipment.includes(key)}
                  onClick={() => toggleEquipment(key)}
                >
                  {t(`prefs.sections.strengthSection.gear.${key}` as any)}
                </Button>
              ))}
            </div>
          </div>

          <textarea
            className="w-full rounded bg-white/5 border border-white/10 p-2.5 text-sm text-white focus:border-white/30 focus:outline-none resize-none placeholder:text-white/20"
            rows={3}
            maxLength={500}
            value={notes}
            placeholder={t("strengthLog.suggestNotesPlaceholder")}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 justify-end px-4 py-3 border-t border-white/10 shrink-0">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" variant="primary" onClick={handleSubmit} disabled={!name.trim() || submitting}>
            {submitting ? t("common.loading") : t("strengthLog.suggestSubmit")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
