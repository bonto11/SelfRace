"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";

import {
  apiSavePushSubscription,
  apiTestPushNotification, // ✅ Pridaný import
} from "@/app/features/account/api/notifications";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import SelectField from "@/app/shared/ui/components/SelectField";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";

import {
  apiGetAccountDeleteStatus,
  apiRequestAccountDelete,
  apiCancelAccountDelete,
} from "@/app/features/account/api/account";

import type {
  UserSettings,
  AccountDeleteStatus,
} from "@/app/features/account/types/account";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  FORM_GRID_TWO,
  FORM_GRID_SPLIT,
  PANEL_STACK,
  INPUTS_CARD_BODY,
  INPUTS_CARD_SAVE_BTN,
} from "@/app/shared/ui/tokens";

const DEFAULT_SETTINGS: UserSettings = {
  units: "metric",
  language: "sk",
  timezone: "Europe/Bratislava",
  week_start: "Mon",
  date_format: "yyyy-MM-dd",
  time_format_24h: true,
};

const LANGUAGES = ["sk", "en"];
const UNITS = ["metric", "imperial"];
const WEEK_STARTS = ["Mon", "Sun"];
const TIME_FORMATS = ["24", "12"];

const TIMEZONES = [
  "UTC",
  "Atlantic/Canary",
  "Europe/Bratislava",
  "Europe/Vienna",
  "Europe/Paris",
  "Europe/Athens",
  "Europe/Helsinki",
  "Africa/Cairo",
  "Europe/Moscow",
  "Asia/Riyadh",
  "America/Sao_Paulo",
  "America/Halifax",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
];

type DeleteModalKind = "request" | "cancel" | null;

type DeleteState = "none" | "pending" | "cancelled" | "deleted";
function getDeleteState(st: AccountDeleteStatus | null): DeleteState {
  const anySt = st as any;
  const status = (anySt?.status as DeleteState | undefined) ?? undefined;
  if (status) return status;

  if (anySt?.hard_deleted_at) return "deleted";
  if (anySt?.cancelled_at) return "cancelled";
  if (anySt?.pending || anySt?.delete_at) return "pending";
  return "none";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function SettingsInputs() {
  const router = useRouter();
  const { userId } = useUserId();
  const t = useT();

  const [open, setOpen] = useState(true);

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deleteStatus, setDeleteStatus] = useState<AccountDeleteStatus | null>(
    null,
  );
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [processingDelete, setProcessingDelete] = useState(false);

  const [deleteModal, setDeleteModal] = useState<DeleteModalKind>(null);
  const [deleteConsentChecked, setDeleteConsentChecked] = useState(false);

  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushTesting, setPushTesting] = useState(false); // ✅ Stav pre testovacie tlačidlo

  const LANGUAGE_OPTIONS = useMemo(
    () =>
      LANGUAGES.map((v) => ({
        value: v,
        label: t(`account.languageOptions.${v}` as any),
      })),
    [t],
  );
  const UNIT_OPTIONS = useMemo(
    () =>
      UNITS.map((v) => ({
        value: v,
        label: t(`account.unitOptions.${v}` as any),
      })),
    [t],
  );
  const WEEK_START_OPTIONS = useMemo(
    () =>
      WEEK_STARTS.map((v) => ({
        value: v,
        label: t(`account.weekStartOptions.${v}` as any),
      })),
    [t],
  );
  const TIME_FORMAT_OPTIONS = useMemo(
    () =>
      TIME_FORMATS.map((v) => ({
        value: v,
        label: t(`account.timeFormatOptions.${v}` as any),
      })),
    [t],
  );
  const TIMEZONE_OPTIONS = useMemo(
    () =>
      TIMEZONES.map((tz) => ({
        value: tz,
        label: t(`account.timezones.${tz}` as any),
      })),
    [t],
  );

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      try {
        const raw = await apiFetchUserPref(userId, "user.settings").catch(
          () => null,
        );
        if (!alive) return;

        if (raw && typeof raw === "object") {
          setSettings((prev) => ({
            ...prev,
            ...(raw as Partial<UserSettings>),
          }));
        } else {
          await apiUpsertUserPref(userId, "user.settings", DEFAULT_SETTINGS);
          setSettings(DEFAULT_SETTINGS);
        }
      } catch (e) {
        console.error("[SettingsInputs] load error", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setDeleteStatus(null);
      return;
    }

    let alive = true;
    setLoadingDelete(true);

    apiGetAccountDeleteStatus(userId)
      .then((st) => {
        if (!alive) return;
        setDeleteStatus(st);
      })
      .catch((e) => console.error("[SettingsInputs] delete status error", e))
      .finally(() => {
        if (alive) setLoadingDelete(false);
      });

    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setPushSupported(true);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setPushSubscribed(true);
        });
      });
    }
  }, []);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    try {
      await apiUpsertUserPref(userId, "user.settings", settings);
      toast.success(t("api.common.saveSuccess"));
      setOpen(false);
    } catch (e: any) {
      console.error("[SettingsInputs] save error", e);
      toast.error(t("api.common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleEnablePush() {
    if (!userId) return;
    if (!pushSupported) {
      toast.error(t("account.push.notSupported"));
      return;
    }

    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(t("account.push.permissionDenied"));
        setPushLoading(false);
        return;
      }

      await navigator.serviceWorker.register('/sw.js');
      
      const reg = await navigator.serviceWorker.ready;
      
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      
      if (!vapidKey) {
        throw new Error("Chýba NEXT_PUBLIC_VAPID_PUBLIC_KEY v prostredí.");
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await apiSavePushSubscription(userId, subscription.toJSON());

      setPushSubscribed(true);
      toast.success(t("account.push.success"));
    } catch (error: any) {
      console.error("[SettingsInputs] Push error:", error);
      toast.error(t("account.push.error"));
    } finally {
      setPushLoading(false);
    }
  }

  // ✅ Funkcia pre testovacie odpálenie
  async function handleTestPush() {
    if (!userId) return;
    setPushTesting(true);
    try {
      await apiTestPushNotification(userId);
      // Fallback text, ak náhodou nemáš preklad pridaný
      toast.success(t("account.push.testSuccess" as any) || "Test notifikácia odoslaná!");
    } catch (error: any) {
      console.error("[SettingsInputs] Test Push error:", error);
      toast.error(t("account.push.testError" as any) || "Nepodarilo sa odoslať test.");
    } finally {
      setPushTesting(false);
    }
  }

  function openDeleteRequestModal() {
    setDeleteConsentChecked(false);
    setDeleteModal("request");
  }

  function openDeleteCancelModal() {
    setDeleteConsentChecked(false);
    setDeleteModal("cancel");
  }

  function closeDeleteModal() {
    setDeleteModal(null);
    setDeleteConsentChecked(false);
  }

  async function confirmRequestDelete() {
    if (!userId || processingDelete) return;

    if (!deleteConsentChecked) {
      toast.error(t("accountDelete.modal.errorCheckbox"));
      return;
    }

    setProcessingDelete(true);
    try {
      const st = await apiRequestAccountDelete(userId);
      setDeleteStatus(st);
      closeDeleteModal();
      toast.success(t("accountDelete.toasts.requestSuccess"));
    } catch (e: any) {
      console.error("[SettingsInputs] delete request error", e);
      toast.error(t(e?.message) || t("api.account.requestFailed"));
    } finally {
      setProcessingDelete(false);
    }
  }

  async function confirmCancelDelete() {
    if (!userId || processingDelete) return;

    if (!deleteConsentChecked) {
      toast.error(t("accountDelete.modal.errorCheckbox"));
      return;
    }

    setProcessingDelete(true);
    try {
      const st = await apiCancelAccountDelete(userId);
      setDeleteStatus(st);
      closeDeleteModal();
      toast.success(t("accountDelete.toasts.cancelSuccess"));
    } catch (e: any) {
      console.error("[SettingsInputs] cancel delete error", e);
      toast.error(t(e?.message) || t("api.account.cancelFailed"));
    } finally {
      setProcessingDelete(false);
    }
  }

  const disabled = !userId || loading || saving;
  const busyAny = saving || processingDelete;

  const deleteState = getDeleteState(deleteStatus);
  const deletePending = deleteState === "pending";
  const deleteCancelled = deleteState === "cancelled";

  const deleteAtLabel =
    deleteStatus?.delete_at &&
    (() => {
      try {
        return new Date(deleteStatus.delete_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch {
        return deleteStatus.delete_at as any;
      }
    })();

  const previewText = useMemo(() => {
    const lang = settings.language === "sk" ? "SK" : "EN";
    const units = settings.units === "metric" ? "metric" : "imperial";
    const wk = settings.week_start;
    const tf = settings.time_format_24h ? "24h" : "12h";
    const tz = settings.timezone || "—";

    const del = loadingDelete
      ? t("account.preview.deleteLoading")
      : deleteState === "pending"
        ? `${t("account.preview.deletePending")}: ${deleteAtLabel ?? "pending"}`
        : deleteState === "cancelled"
          ? t("account.preview.deleteCancelled")
          : t("account.preview.deleteNone");

    return `${lang} • ${units} • ${tz} • ${t("account.preview.week")} ${wk} • ${tf} • ${del}`;
  }, [settings, loadingDelete, deleteState, deleteAtLabel, t]);

  return (
    <>
      <InputsCard
        title={t("account.settings.title")}
        subtitle={t("account.settings.subtitle")}
        preview={previewText}
        open={open}
        onOpenChange={setOpen}
        backdropVariant="default"
        actions={
          <Button
            size="sm"
            variant="primary"
            disabled={disabled}
            onClick={handleSave}
            className={INPUTS_CARD_SAVE_BTN}
          >
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        }
      >
        <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
          <div className={FORM_GRID_TWO}>
            <SelectField
              label={t("account.settings.labels.language")}
              variant="editable"
              value={settings.language}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  language: (e.target.value as "sk" | "en") || "sk",
                }))
              }
              options={LANGUAGE_OPTIONS}
            />

            <SelectField
              label={t("account.settings.labels.units")}
              variant="readonly"
              value={settings.units}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  units: (e.target.value as "metric" | "imperial") || "metric",
                }))
              }
              options={UNIT_OPTIONS}
            />

            <SelectField
              label={t("account.settings.labels.timezone")}
              hint={t("account.settings.labels.timezoneHint")}
              variant="readonly"
              value={settings.timezone}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  timezone: e.target.value || "Europe/Bratislava",
                }))
              }
              options={TIMEZONE_OPTIONS}
            />

            <SelectField
              label={t("account.settings.labels.weekStart")}
              variant="readonly"
              value={settings.week_start}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  week_start: (e.target.value as "Mon" | "Sun") || "Mon",
                }))
              }
              options={WEEK_START_OPTIONS}
            />

            <div>
              <div
                className="text-xs font-medium"
                style={{ color: appColors.textMuted }}
              >
                {t("account.dateFormat")}
              </div>
              <div className="mt-1">
                <TextField
                  variant="readonly"
                  type="text"
                  value={settings.date_format}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, date_format: e.target.value }))
                  }
                  placeholder="yyyy-MM-dd"
                  disabled={disabled}
                />
              </div>
            </div>

            <SelectField
              label={t("account.settings.labels.timeFormat")}
              variant="readonly"
              value={settings.time_format_24h ? "24" : "12"}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  time_format_24h: e.target.value === "24",
                }))
              }
              options={TIME_FORMAT_OPTIONS}
            />
          </div>

          <div
            className="mt-4 pt-3 border-t"
            style={{ borderColor: appColors.divider }}
          >
            <div
              className="text-sm font-semibold"
              style={{ color: appColors.textPrimary }}
            >
              {t("account.actions")}
            </div>
            <p className="text-xs mt-1" style={{ color: appColors.textMuted }}>
              {t("account.quickActions")}
            </p>

            <div className={["mt-2", FORM_GRID_SPLIT].join(" ")}>
              <Button
                size="xs"
                variant="primary"
                onClick={() => router.push("/forgot-password")}
                disabled={!userId}
              >
                {t("account.btnChangePassword")}
              </Button>

              <Button
                size="xs"
                variant="primary"
                onClick={() => router.push("/profile")}
                disabled={!userId}
              >
                {t("account.btnChangeMail")}
              </Button>
            </div>
          </div>

          <div
            className="mt-4 pt-3 border-t"
            style={{ borderColor: appColors.divider }}
          >
            <div
              className="text-sm font-semibold"
              style={{ color: appColors.textPrimary }}
            >
              {t("account.push.title")}
            </div>
            <p className="text-xs mt-1" style={{ color: appColors.textMuted }}>
              {t("account.push.desc")}
            </p>
            {/* ✅ PRIDANÝ FLEX PRE DVE TLAČIDLÁ VEDĽA SEBA */}
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="xs"
                variant={pushSubscribed ? "secondary" : "primary"}
                onClick={handleEnablePush}
                disabled={!pushSupported || pushSubscribed || pushLoading || !userId}
              >
                {pushLoading && <LoadingSpinner size="button" className="mr-2" />}
                {pushSubscribed 
                  ? t("account.push.btnActive") 
                  : t("account.push.btnEnable")}
              </Button>

              {/* Tlačidlo na test sa ukáže len vtedy, ak sú notifikácie už zapnuté */}
              {pushSubscribed && (
                <Button
                  size="xs"
                  variant="primary"
                  onClick={handleTestPush}
                  disabled={pushTesting || !userId}
                  title="Odoslať testovaciu notifikáciu"
                >
                  {pushTesting && <LoadingSpinner size="button" className="mr-2" />}
                  Test
                </Button>
              )}
            </div>
            {!pushSupported && (
              <p className="text-[11px] mt-1 text-red-500">
                {t("account.push.notSupportedHint")}
              </p>
            )}
          </div>

          <div
            className="mt-4 pt-3 border-t"
            style={{ borderColor: appColors.divider }}
          >
            <div
              className="text-sm font-semibold"
              style={{ color: appColors.statusError }}
            >
              {t("accountDelete.title")}
            </div>

            <div
              className="mt-2 rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: deleteCancelled
                  ? "rgba(148,163,184,0.35)"
                  : "rgba(239,68,68,0.55)",
                background: deleteCancelled
                  ? "rgba(30,41,59,0.35)"
                  : "rgba(127,29,29,0.35)",
                color: appColors.textPrimary,
              }}
            >
              {loadingDelete ? (
                <p style={{ color: appColors.textMuted }}>
                  {t("accountDelete.checkingStatus")}
                </p>
              ) : deletePending ? (
                <>
                  <p>
                    {t("accountDelete.status.accountIs")}{" "}
                    <span className="font-semibold">
                      {t("accountDelete.status.pendingLabel")}
                    </span>
                    .
                  </p>
                  <p className="mt-1" style={{ color: appColors.textMuted }}>
                    {t("accountDelete.status.pendingDesc")}
                    {deleteAtLabel ? (
                      <>
                        {" "}
                        {t("accountDelete.status.estimatedDate")}{" "}
                        <span
                          className="font-semibold"
                          style={{ color: appColors.textPrimary }}
                        >
                          {deleteAtLabel}
                        </span>
                        .
                      </>
                    ) : (
                      "."
                    )}
                  </p>
                  <p className="mt-1" style={{ color: appColors.textMuted }}>
                    {t("accountDelete.status.stravaNote")}
                  </p>
                </>
              ) : deleteCancelled ? (
                <>
                  <p>
                    {t("accountDelete.status.plannedDeletionWas")}{" "}
                    <span className="font-semibold">
                      {t("accountDelete.status.cancelledLabel")}
                    </span>
                    .
                  </p>
                  <p className="mt-1" style={{ color: appColors.textMuted }}>
                    {t("accountDelete.status.cancelledDesc")}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    {t("accountDelete.status.deletionIs")}{" "}
                    <span className="font-semibold">
                      {t("accountDelete.status.defaultLabel")}
                    </span>
                    .
                  </p>
                  <p className="mt-1" style={{ color: appColors.textMuted }}>
                    {t("accountDelete.status.defaultDesc")}
                  </p>
                  <p className="mt-1" style={{ color: appColors.textMuted }}>
                    {t("accountDelete.status.stravaNote")}
                  </p>
                </>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              {deletePending ? (
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={busyAny || !userId}
                  onClick={openDeleteCancelModal}
                >
                  {t("accountDelete.buttons.cancelDelete")}
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant={"danger" as any}
                  disabled={busyAny || !userId}
                  onClick={openDeleteRequestModal}
                >
                  {t("accountDelete.buttons.requestDelete")}
                </Button>
              )}

              {deleteCancelled && (
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={loadingDelete || !userId}
                  onClick={() => {
                    setLoadingDelete(true);
                    apiGetAccountDeleteStatus(userId!)
                      .then(setDeleteStatus)
                      .catch((e) =>
                        console.error(
                          "[SettingsInputs] delete status refresh error",
                          e,
                        ),
                      )
                      .finally(() => setLoadingDelete(false));
                  }}
                >
                  {t("accountDelete.buttons.refreshState")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </InputsCard>

      {deleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-xl border p-4"
            style={{
              background: appColors.surfaceCard,
              borderColor: "rgba(239, 68, 68, 0.35)",
              color: appColors.textPrimary,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div
                  className="text-base font-semibold"
                  style={{ color: "rgba(254, 202, 202, 0.95)" }}
                >
                  {deleteModal === "request"
                    ? t("accountDelete.modal.titleRequest")
                    : t("accountDelete.modal.titleCancel")}
                </div>
                <div
                  className="text-[12px] mt-1"
                  style={{ color: appColors.textMuted }}
                >
                  {deleteModal === "request"
                    ? t("accountDelete.modal.subtitleRequest")
                    : t("accountDelete.modal.subtitleCancel")}
                </div>
              </div>

              <button
                type="button"
                onClick={closeDeleteModal}
                className="text-xl leading-none opacity-70 hover:opacity-100"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {deleteModal === "request" ? (
              <div
                className="mt-3 text-sm"
                style={{ color: appColors.textMuted }}
              >
                {t("accountDelete.modal.infoRequest")}
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li>{t("accountDelete.modal.bullets.b1")}</li>
                  <li>{t("accountDelete.modal.bullets.b2")}</li>
                  <li>{t("accountDelete.modal.bullets.b3")}</li>
                </ul>
              </div>
            ) : (
              <div
                className="mt-3 text-sm"
                style={{ color: appColors.textMuted }}
              >
                {t("accountDelete.modal.infoCancel")}
              </div>
            )}

            <div className="mt-4">
              <Checkbox
                checked={deleteConsentChecked}
                onChange={(e) =>
                  setDeleteConsentChecked(e.currentTarget.checked)
                }
                label={
                  <span className="text-sm">
                    {deleteModal === "request"
                      ? t("accountDelete.modal.consentRequest")
                      : t("accountDelete.modal.consentCancel")}
                  </span>
                }
                hint={
                  <span className="text-[11px]">
                    {t("accountDelete.modal.consentHint")}
                  </span>
                }
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={closeDeleteModal}
                disabled={processingDelete}
              >
                {t("accountDelete.modal.btnCancel")}
              </Button>

              {deleteModal === "request" ? (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!deleteConsentChecked || processingDelete}
                  onClick={confirmRequestDelete}
                  title={
                    !deleteConsentChecked
                      ? t("accountDelete.modal.errorCheckbox")
                      : t("accountDelete.buttons.requestDelete")
                  }
                >
                  {processingDelete ? (
                    <span className="inline-flex items-center gap-1">
                      <LoadingSpinner size="button" />
                      {t("accountDelete.modal.btnProcessing")}
                    </span>
                  ) : (
                    t("accountDelete.buttons.requestDelete")
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!deleteConsentChecked || processingDelete}
                  onClick={confirmCancelDelete}
                  title={
                    !deleteConsentChecked
                      ? t("accountDelete.modal.errorCheckbox")
                      : t("accountDelete.buttons.cancelDelete")
                  }
                >
                  {processingDelete ? (
                    <span className="inline-flex items-center gap-1">
                      <LoadingSpinner size="button" />
                      {t("accountDelete.modal.btnProcessing")}
                    </span>
                  ) : (
                    t("accountDelete.buttons.cancelDelete")
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
