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
  type HealthLogRecord,
} from "@/app/features/coach/api/users_health_log";

import type { InjuryArea, InjuryType } from "@/app/features/prefs/types/prefs";

const EVENT_TYPES = ["injury", "illness", "fatigue"] as const;
const SEVERITY_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const INJ_AREAS: InjuryArea[] = [
  "foot", "ankle", "achilles", "shin", "calf", "knee", "quad", "hamstring",
  "glute", "hip", "psoas", "groin", "abdomen", "back", "neck", "shoulder",
  "arm_wrist", "other",
];

const INJ_TYPES: InjuryType[] = [
  "overuse", "acute", "muscle_strain", "tendon", "stress", "shin_splints",
  "plantar", "itb", "other",
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
            {subtitle ? <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div> : null}
          </div>
        </header>
      )}
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>{children}</div>
      <div className={ACCORDION_FOOTER_BAR_MUTED} />
    </section>
  );
}

type DraftForm = {
  event_type: "injury" | "illness" | "fatigue";
  area: InjuryArea;
  type: InjuryType;
  severity: number;
  notes: string;
};

export default function DetailHealthLog() {
  const { userId } = useUserId();
  const t = useT();
  const router = useRouter();

  const [activeLogs, setActiveLogs] = useState<HealthLogRecord[]>([]);
  const [historyLogs, setHistoryLogs] = useState<HealthLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Drafty pre hromadné ukladanie
  const [drafts, setDrafts] = useState<HealthLogRecord[]>([]);

  const [form, setForm] = useState<DraftForm>({
    event_type: "injury",
    area: "knee",
    type: "overuse",
    severity: 3,
    notes: "",
  });

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [active, history] = await Promise.all([
        apiGetActiveHealthLogs(userId),
        apiGetHealthHistory(userId),
      ]);
      setActiveLogs(active ?? []);
      setHistoryLogs(history ?? []);
    } catch (e) {
      console.error(e);
      toast.error(t("healthLog.errorLoad"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const getSeverityColor = (val: number) => {
    if (val <= 3) return "bg-emerald-500 border-emerald-500 text-black";
    if (val <= 6) return "bg-yellow-500 border-yellow-500 text-black";
    return "bg-red-500 border-red-500 text-white";
  };

  const handleAddDraft = () => {
    if (!form.event_type || !form.severity) return;
    
    // Zostavenie JSONu detailov iba ak ide o zranenie
    const details = form.event_type === "injury" 
      ? { area: form.area, type: form.type } 
      : {};

    const newDraft: HealthLogRecord = {
      event_type: form.event_type,
      severity: form.severity,
      notes: form.notes.trim() || undefined,
      status: "active",
      details: details
    };

    setDrafts((prev) => [...prev, newDraft]);
    
    // Reset form
    setForm({
      event_type: form.event_type,
      area: "knee",
      type: "overuse",
      severity: 3,
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
      toast.success(t("healthLog.saveSuccess"));
      
      setDrafts([]);
      await fetchData();
    } catch (e: any) {
      toast.error(e?.message || t("healthLog.errorSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (logId: number) => {
    if (!userId) return;
    try {
      await apiResolveHealthLog(userId, logId);
      toast.success(t("healthLog.resolveSuccess"));
      await fetchData();
    } catch (e: any) {
      toast.error(e?.message || t("healthLog.errorResolve"));
    }
  };

  const handleDelete = async (logId: number) => {
    if (!userId) return;
    const ok = await confirm({
      title: t("healthLog.deleteConfirm.title"),
      message: t("healthLog.deleteConfirm.message"),
      okText: t("healthLog.deleteConfirm.ok"),
      cancelText: t("common.cancel"),
      tone: "danger"
    });
    if (!ok) return;

    try {
      await apiDeleteHealthLog(userId, logId);
      toast.success(t("healthLog.deleteSuccess"));
      await fetchData();
    } catch (e: any) {
      toast.error(t("healthLog.errorDelete"));
    }
  };

  const handleAdaptPlan = async () => {
    // TODO: Zavolať API pre prepočet plánu
    console.log("Adapt plan clicked");
    toast.success(t("healthLog.planAdapting"));
  };

  if (!userId) {
    return (
      <Card title={t("healthLog.pageTitle")} subtitle={t("common.errors.missingUserAuth")}>
        <div className={PANEL_PREVIEW}>{t("common.errors.checkLogin")}</div>
      </Card>
    );
  }

  const isInjury = form.event_type === "injury";

  return (
    <div className={PANEL_STACK}>
      
      {/* 1. PRIDANIE ZÁZNAMU A DRAFTY */}
      <Card title={t("healthLog.addTitle")} subtitle={t("healthLog.addSubtitle")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* ĽAVÝ STĹPEC: Typ udalosti a špecifikácie */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-medium opacity-80 mb-2">{t("healthLog.form.typeLabel")}</div>
              {/* ZMENA 1: flex-col namiesto flex-row pre hlavné kategórie */}
              <div className="flex flex-col gap-2">
                {EVENT_TYPES.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant="prefs"
                    active={form.event_type === type}
                    onClick={() => setForm({ ...form, event_type: type })}
                    className="w-full justify-start capitalize"
                  >
                    <span className="mr-2 text-lg">{type === "illness" ? "🦠" : type === "fatigue" ? "🔋" : "🩹"}</span>
                    {t(`healthLog.types.${type}` as any)}
                  </Button>
                ))}
              </div>
            </div>

            {isInjury && (
              <>
                <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <div className="text-xs font-medium opacity-80 mb-2">{t("healthLog.form.areaLabel")}</div>
                  {/* ZMENA 2: mriežka 2-stĺpcová, menšie custom paddingy a text */}
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
                  <div className="text-xs font-medium opacity-80 mb-2">{t("healthLog.form.injuryTypeLabel")}</div>
                  {/* ZMENA 3: mriežka 2-stĺpcová */}
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
          </div>

          {/* PRAVÝ STĹPEC: Závažnosť a poznámka */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium opacity-80">{t("healthLog.form.severityLabel")}</div>
              </div>
              <div className="flex gap-1 mb-2">
                {SEVERITY_SCALE.map((num) => {
                  const isActive = form.severity === num;
                  const colorClass = isActive ? getSeverityColor(num) : "bg-black/30 border-white/10 text-white/70 hover:bg-white/10";
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
                  ? t("healthLog.form.severityCriticalHint")
                  : t("healthLog.form.severityMildHint")}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <TextField
                label={t("healthLog.form.notesLabel")}
                placeholder={t("healthLog.form.notesPlaceholder")}
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: (e.target as HTMLInputElement).value })}
              />
            </div>

            {/* ZMENA 4: Primary variant pre pridanie */}
            <Button size="md" variant="primary" onClick={handleAddDraft}>
              {t("healthLog.form.addDraftBtn")}
            </Button>
          </div>
        </div>

        {/* ZOZNAM DRAFTOV (Neuložené zmeny) */}
        {drafts.length > 0 && (
          <div className="mt-4 p-3 border border-yellow-500/20 bg-yellow-500/10 rounded-xl">
            <div className="text-xs font-bold text-yellow-400 mb-3">{t("healthLog.form.draftsTitle")}</div>
            <ul className="space-y-2 mb-4">
              {drafts.map((d, idx) => {
                const isInj = d.event_type === "injury";
                const eventName = isInj && d.details?.area && d.details?.type
                  ? `${t(`healthLog.injAreas.${d.details.area}` as any)} · ${t(`healthLog.injTypes.${d.details.type}` as any)}`
                  : t(`healthLog.types.${d.event_type}` as any);

                return (
                  <li key={idx} className="flex justify-between items-center text-sm bg-black/30 border border-white/5 px-3 py-2 rounded-lg">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white/90">
                        {eventName} <span className="opacity-60 font-normal">({d.severity}/10)</span>
                      </span>
                      {d.notes && <span className="text-xs text-white/60">{d.notes}</span>}
                    </div>
                    <button onClick={() => handleRemoveDraft(idx)} className="text-red-400 hover:text-red-300 text-xs px-2 py-1">
                      {t("common.delete")}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button size="md" variant="primary" onClick={handleSaveDrafts} disabled={saving} className="w-full">
              {saving ? <LoadingSpinner size="button" /> : t("healthLog.form.saveButton")}
            </Button>
          </div>
        )}
      </Card>

      {/* 2. AKTÍVNE PROBLÉMY A PRISPÔSOBENIE PLÁNU */}
      <Card title={t("healthLog.activeTitle")} subtitle={t("healthLog.activeSubtitle")}>
        {loading ? (
          <div className="flex justify-center p-4"><LoadingSpinner size="button" /></div>
        ) : activeLogs.length === 0 ? (
          <div className={PANEL_PREVIEW}>
            <span className="text-emerald-400 font-bold">✅ {t("healthLog.widget.allGood")}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-2">
              {activeLogs.map((log) => {
                const isIllness = log.event_type === "illness";
                const isCritical = log.severity >= 7;
                
                const eventName = log.event_type === "injury" && log.details?.area && log.details?.type
                  ? `${t(`healthLog.injAreas.${log.details.area}` as any)} · ${t(`healthLog.injTypes.${log.details.type}` as any)}`
                  : t(`healthLog.types.${log.event_type}` as any);

                return (
                  <li key={log.id} className={`rounded-xl border px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isCritical ? "border-red-500/30 bg-red-500/10" : "border-yellow-500/30 bg-yellow-500/10"
                  }`}>
                    <div>
                      <div className={`text-sm font-bold ${isCritical ? "text-red-300" : "text-yellow-300"}`}>
                        <span className="mr-1">{isIllness ? "🦠" : log.event_type === "fatigue" ? "🔋" : "🩹"}</span>
                        {eventName}
                        <span className="opacity-70 ml-2 font-normal">({log.severity}/10)</span>
                      </div>
                      <div className="text-xs opacity-70 mt-1">
                        {t("healthLog.startDate")}: {formatDate(log.start_date)}
                      </div>
                      {log.notes && <div className="text-sm mt-1 opacity-90">{log.notes}</div>}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button size="xs" variant="secondary" onClick={() => handleResolve(log.id!)}>
                        ✓ {t("healthLog.actions.resolve")}
                      </Button>
                      <Button size="xs" variant="danger" onClick={() => handleDelete(log.id!)} title={t("healthLog.actions.delete")}>
                        🗑️
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* AKCIA: Prispôsobiť plán */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-blue-100/90 leading-snug">
                <strong>{t("healthLog.replanAlert.title")}</strong><br/>
                {t("healthLog.replanAlert.text")}
              </div>
              <Button size="md" variant="primary" onClick={handleAdaptPlan} className="whitespace-nowrap">
                {t("healthLog.replanAlert.button")}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 3. HISTÓRIA */}
      {historyLogs.length > 0 && (
        <Card title={t("healthLog.historyTitle")}>
          <ul className="space-y-2 opacity-80">
            {historyLogs.map((log) => {
              const eventName = log.event_type === "injury" && log.details?.area && log.details?.type
                ? `${t(`healthLog.injAreas.${log.details.area}` as any)} · ${t(`healthLog.injTypes.${log.details.type}` as any)}`
                : t(`healthLog.types.${log.event_type}` as any);

              return (
                <li key={log.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white/80">
                      {eventName} <span className="font-normal opacity-60">({log.severity}/10)</span>
                    </div>
                    {log.notes && <div className="text-xs text-white/60 mt-0.5">{log.notes}</div>}
                  </div>
                  <div className="text-xs text-white/50 whitespace-nowrap">
                    {formatDate(log.start_date)} – {log.end_date ? formatDate(log.end_date) : t("healthLog.today")}
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