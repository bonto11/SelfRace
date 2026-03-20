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

const EVENT_TYPES = ["injury", "illness", "fatigue"] as const;
const SEVERITY_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

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

export default function DetailHealthLog() {
  const { userId } = useUserId();
  const t = useT();
  const router = useRouter();

  const [activeLogs, setActiveLogs] = useState<HealthLogRecord[]>([]);
  const [historyLogs, setHistoryLogs] = useState<HealthLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Partial<HealthLogRecord>>({
    event_type: "injury",
    severity: 5,
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

  const handleSaveNew = async () => {
    if (!userId || !form.event_type || !form.severity) return;
    setSaving(true);
    try {
      const newLog: HealthLogRecord = {
        event_type: form.event_type as any,
        severity: form.severity,
        notes: form.notes?.trim() || "",
        status: "active",
      };
      await apiSaveHealthLogs(userId, [newLog]);
      toast.success(t("healthLog.saveSuccess"));
      
      setForm({ event_type: form.event_type, severity: 5, notes: "" });
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

  if (!userId) {
    return (
      <Card title={t("healthLog.pageTitle")} subtitle={t("common.errors.missingUserAuth")}>
        <div className={PANEL_PREVIEW}>{t("common.errors.checkLogin")}</div>
      </Card>
    );
  }

  return (
    <div className={PANEL_STACK}>
      
      <Card
        title={t("healthLog.addTitle")}
        subtitle={t("healthLog.addSubtitle")}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-medium opacity-80 mb-2">{t("healthLog.form.typeLabel")}</div>
            <div className="flex flex-col gap-2">
              {EVENT_TYPES.map((type) => (
                <Button
                  key={type}
                  type="button"
                  size="sm"
                  variant="prefs"
                  active={form.event_type === type}
                  onClick={() => setForm({ ...form, event_type: type })}
                  className="justify-start capitalize"
                >
                  <span className="mr-2">
                    {type === "illness" ? "🦠" : type === "fatigue" ? "🔋" : "🩹"}
                  </span>
                  {t(`healthLog.types.${type}` as any) || type}
                </Button>
              ))}
            </div>
          </div>

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
          </div>
        </div>

        <div className="mt-2">
          <Button size="md" variant="primary" onClick={handleSaveNew} disabled={saving} className="w-full md:w-auto">
            {saving ? <LoadingSpinner size="button" /> : t("healthLog.form.saveButton")}
          </Button>
        </div>
      </Card>

      <Card
        title={t("healthLog.activeTitle")}
        subtitle={t("healthLog.activeSubtitle")}
      >
        {loading ? (
          <div className="flex justify-center p-4"><LoadingSpinner size="button" /></div>
        ) : activeLogs.length === 0 ? (
          <div className={PANEL_PREVIEW}>
            <span className="text-emerald-400 font-bold">✅ {t("healthLog.widget.allGood")}</span>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2">
              {activeLogs.map((log) => {
                const isIllness = log.event_type === "illness";
                const isCritical = log.severity >= 7;
                return (
                  <li key={log.id} className={`rounded-xl border px-3 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isCritical ? "border-red-500/30 bg-red-500/10" : "border-yellow-500/30 bg-yellow-500/10"
                  }`}>
                    <div>
                      <div className={`text-sm font-bold capitalize ${isCritical ? "text-red-300" : "text-yellow-300"}`}>
                        <span className="mr-1">{isIllness ? "🦠" : log.event_type === "fatigue" ? "🔋" : "🩹"}</span>
                        {t(`healthLog.types.${log.event_type}` as any) || log.event_type}
                        <span className="opacity-70 ml-2">({log.severity}/10)</span>
                      </div>
                      <div className="text-xs opacity-70 mt-1">
                        {t("healthLog.startDate")}: {formatDate(log.start_date)}
                      </div>
                      {log.notes && <div className="text-sm mt-1">{log.notes}</div>}
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

            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="text-sm text-blue-200">
                <strong>{t("healthLog.replanAlert.title")}</strong> {t("healthLog.replanAlert.text")}
              </div>
              <Button size="sm" variant="primary" onClick={() => router.push("/coach")}>
                {t("healthLog.replanAlert.button")}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {historyLogs.length > 0 && (
        <Card title={t("healthLog.historyTitle")}>
          <ul className="space-y-2 opacity-80">
            {historyLogs.map((log) => (
              <li key={log.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold capitalize text-white/80">
                    {t(`healthLog.types.${log.event_type}` as any) || log.event_type} ({log.severity}/10)
                  </div>
                  {log.notes && <div className="text-xs text-white/60 mt-0.5">{log.notes}</div>}
                </div>
                <div className="text-xs text-white/50 whitespace-nowrap">
                  {formatDate(log.start_date)} – {log.end_date ? formatDate(log.end_date) : t("healthLog.today")}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

    </div>
  );
}