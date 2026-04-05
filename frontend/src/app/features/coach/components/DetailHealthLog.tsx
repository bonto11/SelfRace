"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { formatDate } from "@/app/shared/utils/time";

import { apiGetStaticProfile } from "@/app/features/performance/api/static";

import {
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
} from "@/app/shared/ui/tokens/sessionCard";

import {
  apiGetActiveHealthLogs,
  apiGetHealthHistory,
  apiSaveHealthLogs,
  apiResolveHealthLog,
  apiDeleteHealthLog,
  apiAdaptPlanForHealth,
  type HealthLogRecord,
} from "@/app/features/coach/api/users_health_log";

import type { InjuryArea, InjuryType } from "@/app/features/prefs/types/prefs";

const EVENT_TYPES = ["injury", "illness", "fatigue", "menstruation"] as const;
const SEVERITY_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const INJ_AREAS: InjuryArea[] = [
  "foot",
  "ankle",
  "achilles",
  "shin",
  "calf",
  "knee",
  "quad",
  "hamstring",
  "glute",
  "hip",
  "psoas",
  "groin",
  "abdomen",
  "back",
  "neck",
  "shoulder",
  "arm_wrist",
  "other",
];

const INJ_TYPES: InjuryType[] = [
  "overuse",
  "acute",
  "muscle_strain",
  "tendon",
  "stress",
  "shin_splints",
  "plantar",
  "itb",
  "other",
];

const ILLNESS_SYMPTOMS = [
  { id: "fever", isSevere: true },
  { id: "chest_cough", isSevere: true },
  { id: "muscle_aches", isSevere: true },
  { id: "nausea", isSevere: true },
  { id: "runny_nose", isSevere: false },
  { id: "sore_throat", isSevere: false },
  { id: "headache", isSevere: false },
];

const FATIGUE_SYMPTOMS = [
  { id: "exhaustion", isSevere: true },
  { id: "high_hr", isSevere: true },
  { id: "heavy_legs", isSevere: false },
  { id: "poor_sleep", isSevere: false },
];

function Card({
  title,
  subtitle,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
      {(title || subtitle) && (
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0">
            {title ? <div className={PANEL_SECTION_TITLE}>{title}</div> : null}
            {subtitle ? (
              <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div>
            ) : null}
          </div>
        </header>
      )}
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>{children}</div>
      <div className={ACCORDION_FOOTER_BAR_MUTED} />
    </section>
  );
}

type DraftForm = {
  event_type: "injury" | "illness" | "fatigue" | "menstruation";
  area: InjuryArea;
  type: InjuryType;
  severity: number;
  symptoms: string[];
  notes: string;
};

export default function DetailHealthLog() {
  const { userId } = useUserId();
  const t = useT();
  const router = useRouter();

  const [activeLogs, setActiveLogs] = useState<HealthLogRecord[]>([]);
  const [historyLogs, setHistoryLogs] = useState<HealthLogRecord[]>([]);
  const [isFemale, setIsFemale] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adapting, setAdapting] = useState(false);
  const [drafts, setDrafts] = useState<HealthLogRecord[]>([]);

  const [form, setForm] = useState<DraftForm>({
    event_type: "injury",
    area: "knee",
    type: "overuse",
    severity: 3,
    symptoms: [],
    notes: "",
  });

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [active, history, staticProfile] = await Promise.all([
        apiGetActiveHealthLogs(userId),
        apiGetHealthHistory(userId),
        apiGetStaticProfile(userId)
      ]);
      setActiveLogs(active ?? []);
      setHistoryLogs(history ?? []);
      
      const sex = staticProfile?.sex?.toUpperCase() || "";
      setIsFemale(sex === "F");

    } catch (e) {
      toast.error(t("healthLog.errorLoad" as any));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const activeMenstruationLog = activeLogs.find((l) => (l.event_type as string) === "menstruation");

  const getSeverityColor = (val: number) => {
    if (val <= 3) return "bg-emerald-500 border-emerald-500 text-black";
    if (val <= 6) return "bg-yellow-500 border-yellow-500 text-black";
    return "bg-red-500 border-red-500 text-white";
  };

  const toggleSymptom = (symId: string) => {
    setForm((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(symId)
        ? prev.symptoms.filter((s) => s !== symId)
        : [...prev.symptoms, symId],
    }));
  };

  const handleAddDraft = () => {
    if (!form.event_type) return;

    // Pridaná kontrola pre istotu, ak by mala žena už jeden aktívny cyklus
    if (form.event_type === "menstruation" && activeMenstruationLog) {
      return toast.error("Menštruačný cyklus už máš aktívne zaznamenaný. Najprv starý označ za vyriešený.");
    }

    let computedSeverity = form.severity;
    let details: any = {};

    if (form.event_type === "injury") {
      details = { area: form.area, type: form.type };
    } else if (form.event_type === "illness") {
      if (form.symptoms.length === 0)
        return toast.error(t("healthLog.form.errorNoSymptoms" as any));
      const hasSevere = form.symptoms.some(
        (s) => ILLNESS_SYMPTOMS.find((x) => x.id === s)?.isSevere,
      );
      computedSeverity = hasSevere ? 8 : 3;
      details = { symptoms: form.symptoms };
    } else if (form.event_type === "fatigue") {
      if (form.symptoms.length === 0)
        return toast.error(t("healthLog.form.errorNoSymptoms" as any));
      const hasSevere = form.symptoms.some(
        (s) => FATIGUE_SYMPTOMS.find((x) => x.id === s)?.isSevere,
      );
      computedSeverity = hasSevere ? 7 : 4;
      details = { symptoms: form.symptoms };
    } else if (form.event_type === "menstruation") {
      // ✅ Pridaná podmienka pre menštruáciu (nemá symptómy ani area, len berieme manuálnu závažnosť)
      details = {}; 
    }

    const newDraft: HealthLogRecord = {
      event_type: form.event_type,
      severity: computedSeverity,
      notes: form.notes.trim() || undefined,
      status: "active",
      details: details,
    };

    setDrafts((prev) => [...prev, newDraft]);

    setForm({
      event_type: "injury",
      area: "knee",
      type: "overuse",
      severity: 3,
      symptoms: [],
      notes: "",
    });
  };

  const handleRemoveDraft = (index: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDrafts = async () => {
    if (!userId || drafts.length === 0) return;
    setSaving(true);
    try {
      await apiSaveHealthLogs(userId, drafts);
      toast.success(t("healthLog.saveSuccess" as any));
      setDrafts([]);
      await fetchData();
    } catch (e: any) {
      toast.error(e?.message || t("healthLog.errorSave" as any));
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (logId: number) => {
    if (!userId) return;
    try {
      await apiResolveHealthLog(userId, logId);
      toast.success(t("healthLog.resolveSuccess" as any));
      await fetchData();
    } catch (e: any) {
      toast.error(e?.message || t("healthLog.errorResolve" as any));
    }
  };

  const handleDelete = async (logId: number) => {
    if (!userId) return;
    const ok = await confirm({
      title: t("healthLog.deleteConfirm.title" as any),
      message: t("healthLog.deleteConfirm.message" as any),
      okText: t("healthLog.deleteConfirm.ok" as any),
      cancelText: t("common.cancel" as any),
      tone: "danger",
    });
    if (!ok) return;

    try {
      await apiDeleteHealthLog(userId, logId);
      toast.success(t("healthLog.deleteSuccess" as any));
      await fetchData();
    } catch (e: any) {
      toast.error(t("healthLog.errorDelete" as any));
    }
  };

  const handleAdaptPlan = async () => {
    if (!userId) return;
    setAdapting(true);
    try {
      await apiAdaptPlanForHealth(userId);
      toast.success(
        t("healthLog.planAdapting" as any) || "Plán sa prispôsobuje...",
      );
      router.push("/coach");
    } catch (e: any) {
      toast.error(e?.message || "Chyba pri prispôsobovaní plánu.");
    } finally {
      setAdapting(false);
    }
  };

  if (!userId) {
    return (
      <Card
        title={t("healthLog.pageTitle" as any)}
        subtitle={t("common.errors.missingUserAuth" as any)}
      >
        <div className={PANEL_PREVIEW}>
          {t("common.errors.checkLogin" as any)}
        </div>
      </Card>
    );
  }

  const isInjury = form.event_type === "injury";
  const isIllness = form.event_type === "illness";
  const isFatigue = form.event_type === "fatigue";
  const isMenstruationForm = form.event_type === "menstruation";

  // Spojíme bežné typy a ak je to žena, pridáme menštruáciu ako ďalší plnohodnotný event_type
  const currentEventTypes = isFemale ? [...EVENT_TYPES, "menstruation"] : EVENT_TYPES;

  return (
    <div className={PANEL_STACK}>
      
      {/* 1. PRIDANIE ZÁZNAMU */}
      <Card
        title={t("healthLog.addTitle" as any)}
        subtitle={t("healthLog.addSubtitle" as any)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-medium opacity-80 mb-2">
                {t("healthLog.form.typeLabel" as any)}
              </div>
              <div className="flex flex-col gap-2">
                {currentEventTypes.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant="prefs"
                    active={form.event_type === type}
                    onClick={() =>
                      setForm({ ...form, event_type: type as any, symptoms: [] })
                    }
                    className={`w-full justify-start capitalize ${form.event_type === "menstruation" && type === "menstruation" ? "!bg-pink-500/20 !border-pink-500/50 !text-pink-300" : ""}`}
                  >
                    <span className="mr-2 text-lg">
                      {type === "illness"
                        ? "🦠"
                        : type === "fatigue"
                          ? "🔋"
                          : type === "menstruation"
                            ? "🌸"
                            : "🩹"}
                    </span>
                    {t(`healthLog.types.${type}` as any)}
                  </Button>
                ))}
              </div>
            </div>

            {/* SEKCIA: ZRANENIE */}
            {isInjury && (
              <>
                <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <div className="text-xs font-medium opacity-80 mb-2">
                    {t("healthLog.form.areaLabel" as any)}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {INJ_AREAS.map((a) => (
                      <Button
                        key={a}
                        type="button"
                        size="xs"
                        variant="prefs"
                        active={form.area === a}
                        onClick={() => setForm({ ...form, area: a })}
                        className="w-full justify-start text-[11px] !py-1.5 px-2 font-normal"
                      >
                        {t(`healthLog.injAreas.${a}` as any)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <div className="text-xs font-medium opacity-80 mb-2">
                    {t("healthLog.form.injuryTypeLabel" as any)}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {INJ_TYPES.map((ty) => (
                      <Button
                        key={ty}
                        type="button"
                        size="xs"
                        variant="prefs"
                        active={form.type === ty}
                        onClick={() => setForm({ ...form, type: ty })}
                        className="w-full justify-start text-[11px] !py-1.5 px-2 font-normal"
                      >
                        {t(`healthLog.injTypes.${ty}` as any)}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* SEKCIA: CHOROBA */}
            {isIllness && (
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-xs font-medium opacity-80 mb-1">
                  {t("healthLog.form.symptomsLabel" as any)}
                </div>
                <div className="text-[10px] text-white/50 mb-3">
                  {t("healthLog.form.symptomsIllnessHint" as any)}
                </div>
                <div className="flex flex-col gap-1.5">
                  {ILLNESS_SYMPTOMS.map((sym) => {
                    const isActive = form.symptoms.includes(sym.id);
                    return (
                      <Button
                        key={sym.id}
                        type="button"
                        size="xs"
                        variant="prefs"
                        active={isActive}
                        onClick={() => toggleSymptom(sym.id)}
                        className={`w-full justify-start text-xs !py-2 font-normal ${isActive && sym.isSevere ? "!border-red-500/50 !text-red-200" : ""}`}
                      >
                        <span className="mr-2 opacity-50">
                          {isActive ? "☑" : "☐"}
                        </span>
                        {t(`healthLog.symptoms.${sym.id}` as any)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SEKCIA: ÚNAVA */}
            {isFatigue && (
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-xs font-medium opacity-80 mb-1">
                  {t("healthLog.form.symptomsLabel" as any)}
                </div>
                <div className="text-[10px] text-white/50 mb-3">
                  {t("healthLog.form.symptomsFatigueHint" as any)}
                </div>
                <div className="flex flex-col gap-1.5">
                  {FATIGUE_SYMPTOMS.map((sym) => {
                    const isActive = form.symptoms.includes(sym.id);
                    return (
                      <Button
                        key={sym.id}
                        type="button"
                        size="xs"
                        variant="prefs"
                        active={isActive}
                        onClick={() => toggleSymptom(sym.id)}
                        className={`w-full justify-start text-xs !py-2 font-normal ${isActive && sym.isSevere ? "!border-red-500/50 !text-red-200" : ""}`}
                      >
                        <span className="mr-2 opacity-50">
                          {isActive ? "☑" : "☐"}
                        </span>
                        {t(`healthLog.symptoms.${sym.id}` as any)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* SEKCIA: MENŠTRUÁCIA (Žiadne špecifické doplnky, iba vysvetlenie) */}
            {isMenstruationForm && (
               <div className="rounded-xl border border-pink-500/30 bg-pink-500/10 p-4 text-center">
                 <div className="text-sm font-bold text-pink-300 mb-1">
                   Začiatok cyklu
                 </div>
                 <div className="text-xs text-pink-200/70">
                   Nastav si vážnosť obmedzenia napravo. AI upraví tvoje najbližšie tréningy – 
                   pri nižšej vážnosti len zjemní intervaly a ťažké váhy v posilňovni, 
                   pri vysokej vážnosti ti naordinuje pokojný režim alebo ľahkú prechádzku.
                 </div>
               </div>
            )}
          </div>

          {/* PRAVÝ STĹPEC: Závažnosť a poznámka */}
          <div className="flex flex-col gap-4">
            {(isInjury || isMenstruationForm) && (
              <div className={`rounded-xl border p-3 ${isMenstruationForm ? "border-pink-500/30 bg-pink-500/5" : "border-white/10 bg-white/5"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium opacity-80">
                    {t("healthLog.form.severityLabel" as any)}
                  </div>
                </div>
                <div className="flex gap-1 mb-2">
                  {SEVERITY_SCALE.map((num) => {
                    const isActive = form.severity === num;
                    const colorClass = isActive
                      ? getSeverityColor(num)
                      : "bg-black/30 border-white/10 text-white/70 hover:bg-white/10";
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setForm({ ...form, severity: num })}
                        className={`flex-1 py-1.5 text-xs font-bold rounded border transition-colors ${colorClass}`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-white/50 italic px-1">
                  {form.severity && form.severity >= 7
                    ? t("healthLog.form.severityCriticalHint" as any)
                    : t("healthLog.form.severityMildHint" as any)}
                </div>
              </div>
            )}

            {(!isInjury && !isMenstruationForm) && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 flex flex-col items-center justify-center text-center">
                <div className="text-sm text-white/80 font-medium">
                  {t("healthLog.form.autoSeverityTitle" as any)}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {t("healthLog.form.autoSeverityText" as any)}
                </div>
              </div>
            )}

            <div className={`rounded-xl border p-3 ${isMenstruationForm ? "border-pink-500/30 bg-pink-500/5" : "border-white/10 bg-white/5"}`}>
              <TextField
                label={t("healthLog.form.notesLabel" as any) as string}
                placeholder={
                  t("healthLog.form.notesPlaceholder" as any) as string
                }
                value={form.notes ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notes: (e.target as HTMLInputElement).value,
                  })
                }
              />
            </div>

            <Button
              size="md"
              variant="primary"
              onClick={handleAddDraft}
              className="w-full mt-2"
            >
              {t("healthLog.form.addDraftBtn" as any)}
            </Button>
          </div>
        </div>

        {/* ZOZNAM DRAFTOV */}
        {drafts.length > 0 && (
          <div className="mt-4 p-3 border border-yellow-500/20 bg-yellow-500/10 rounded-xl">
            <div className="text-xs font-bold text-yellow-400 mb-3">
              {t("healthLog.form.draftsTitle" as any)}
            </div>
            <ul className="space-y-2 mb-4">
              {drafts.map((d, idx) => {
                const isInj = d.event_type === "injury";
                const isIllOrFat =
                  d.event_type === "illness" || d.event_type === "fatigue";

                let eventName = t(`healthLog.types.${d.event_type}` as any);
                if (isInj && d.details?.area && d.details?.type) {
                  eventName = `${t(`healthLog.injAreas.${d.details.area}` as any)} · ${t(`healthLog.injTypes.${d.details.type}` as any)}`;
                } else if (isIllOrFat && d.details?.symptoms?.length) {
                  eventName = d.details.symptoms
                    .map((s: string) => t(`healthLog.symptoms.${s}` as any))
                    .join(", ");
                }

                return (
                  <li
                    key={idx}
                    className="flex justify-between items-center text-sm bg-black/30 border border-white/5 px-3 py-2 rounded-lg"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-white/90">
                        {eventName}{" "}
                        <span className="opacity-60 font-normal text-xs ml-1">
                          ({t("healthLog.form.severity" as any)}: {d.severity}
                          /10)
                        </span>
                      </span>
                      {d.notes && (
                        <span className="text-xs text-white/60">{d.notes}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveDraft(idx)}
                      className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
                    >
                      {t("common.delete" as any)}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button
              size="md"
              variant="primary"
              onClick={handleSaveDrafts}
              disabled={saving}
              className="w-full"
            >
              {saving ? (
                <LoadingSpinner size="button" />
              ) : (
                t("healthLog.form.saveButton" as any)
              )}
            </Button>
          </div>
        )}
      </Card>

      {/* 2. AKTÍVNE PROBLÉMY A PRISPÔSOBENIE PLÁNU */}
      <Card
        title={t("healthLog.activeTitle" as any)}
        subtitle={t("healthLog.activeSubtitle" as any)}
      >
        {loading ? (
          <div className="flex justify-center p-4">
            <LoadingSpinner size="button" />
          </div>
        ) : activeLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl gap-3">
            <span className="text-emerald-400 font-bold text-lg">
              ✅ {t("healthLog.widget.allGood" as any)}
            </span>
            <span className="text-xs text-emerald-200/70 max-w-sm">
              {t("healthLog.returnToTrainingDesc" as any)}
            </span>
            <Button
              size="sm"
              variant="primary"
              onClick={handleAdaptPlan}
              disabled={adapting}
              className="mt-2"
            >
              {adapting ? (
                <LoadingSpinner size="button" />
              ) : (
                t("healthLog.returnToTrainingBtn" as any)
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-2">
              {activeLogs.map((log) => {
                const isIllness = log.event_type === "illness";
                const isFatigue = log.event_type === "fatigue";
                const isMenstruation = (log.event_type as string) === "menstruation";
                const isCritical = log.severity >= 7;

                let eventName = t(`healthLog.types.${log.event_type}` as any);
                if (
                  log.event_type === "injury" &&
                  log.details?.area &&
                  log.details?.type
                ) {
                  eventName = `${t(`healthLog.injAreas.${log.details.area}` as any)} · ${t(`healthLog.injTypes.${log.details.type}` as any)}`;
                } else if (
                  (isIllness || isFatigue) &&
                  log.details?.symptoms?.length
                ) {
                  eventName = log.details.symptoms
                    .map((s: string) => t(`healthLog.symptoms.${s}` as any))
                    .join(", ");
                }

                return (
                  <li
                    key={log.id}
                    className={`rounded-xl border px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      isMenstruation 
                        ? "border-pink-500/40 bg-pink-500/10"
                        : isCritical
                          ? "border-red-500/30 bg-red-500/10"
                          : "border-yellow-500/30 bg-yellow-500/10"
                    }`}
                  >
                    <div>
                      <div
                        className={`text-sm font-bold ${
                          isMenstruation 
                            ? "text-pink-400" 
                            : isCritical ? "text-red-300" : "text-yellow-300"
                        }`}
                      >
                        <span className="mr-1">
                          {isIllness ? "🦠" : isFatigue ? "🔋" : isMenstruation ? "🌸" : "🩹"}
                        </span>
                        {eventName}
                        <span className="opacity-70 ml-2 font-normal">
                          ({log.severity}/10)
                        </span>
                      </div>
                      <div className="text-xs opacity-70 mt-1">
                        {t("healthLog.startDate" as any)}:{" "}
                        {formatDate(log.start_date)}
                      </div>
                      {log.notes && (
                        <div className="text-sm mt-1 opacity-90">
                          {log.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => handleResolve(log.id!)}
                      >
                        ✓ {t("healthLog.actions.resolve" as any)}
                      </Button>
                      <Button
                        size="xs"
                        variant="danger"
                        onClick={() => handleDelete(log.id!)}
                        title={t("healthLog.actions.delete" as any) as string}
                      >
                        🗑️
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-blue-100/90 leading-snug">
                <strong>{t("healthLog.replanAlert.title" as any)}</strong>
                <br />
                {t("healthLog.replanAlert.text" as any)}
              </div>
              <Button
                size="md"
                variant="primary"
                onClick={handleAdaptPlan}
                disabled={adapting}
                className="whitespace-nowrap"
              >
                {adapting ? (
                  <LoadingSpinner size="button" />
                ) : (
                  t("healthLog.replanAlert.button" as any)
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 3. HISTÓRIA */}
      {historyLogs.length > 0 && (
        <Card title={t("healthLog.historyTitle" as any)}>
          <ul className="space-y-2 opacity-80">
            {historyLogs.map((log) => {
              const isIllness = log.event_type === "illness";
              const isFatigue = log.event_type === "fatigue";
              const isMenstruation = (log.event_type as string) === "menstruation";

              let eventName = t(`healthLog.types.${log.event_type}` as any);
              if (
                log.event_type === "injury" &&
                log.details?.area &&
                log.details?.type
              ) {
                eventName = `${t(`healthLog.injAreas.${log.details.area}` as any)} · ${t(`healthLog.injTypes.${log.details.type}` as any)}`;
              } else if (
                (isIllness || isFatigue) &&
                log.details?.symptoms?.length
              ) {
                eventName = log.details.symptoms
                  .map((s: string) => t(`healthLog.symptoms.${s}` as any))
                  .join(", ");
              }

              return (
                <li
                  key={log.id}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-sm font-semibold text-white/80">
                      <span className="mr-1">
                        {isIllness ? "🦠" : isFatigue ? "🔋" : isMenstruation ? "🌸" : "🩹"}
                      </span>
                      {eventName}{" "}
                      <span className="font-normal opacity-60">
                        ({log.severity}/10)
                      </span>
                    </div>
                    {log.notes && (
                      <div className="text-xs text-white/60 mt-0.5">
                        {log.notes}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-white/50 whitespace-nowrap">
                    {formatDate(log.start_date)} –{" "}
                    {log.end_date
                      ? formatDate(log.end_date)
                      : t("healthLog.today" as any)}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
