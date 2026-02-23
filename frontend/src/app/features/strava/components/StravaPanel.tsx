"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/CheckBox";
import { STRAVA_ASSETS } from "@/app/shared/ui/components/Strava";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { apiSyncActivities } from "@/app/features/strava/api/synchronization";
import type { SyncActivitiesStats } from "@/app/features/activities/types/synchronization";
import { API_URL } from "@/app/shared/config";

import {
  apiGetStravaStatus,
  type StravaStatus,
  apiDisconnectStrava,
  getStravaConnectUrl,
  canConnectStravaNow,
} from "../api/strava";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  PANEL,
  PANEL_PAD,
  PANEL_HEADER,
  PANEL_TITLE,
  PANEL_SUBTITLE,
  PANEL_STATUS_COL,
  PANEL_STATUS_PILL,
  PANEL_BRAND_TINY,
  PANEL_INNER_STACK,
  PANEL_SECTION,
  PANEL_SECTION_DIVIDER,
  PANEL_SECTION_LABEL,
  PANEL_SECTION_TEXT,
  PANEL_ACTIONS_INLINE,
  SURFACE_INSET_STYLE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

type BusyKind = "import" | "disconnect" | null;

function fmtIsoLocal(iso?: string | null): string | null {
  if (!iso) return null;
  return iso;
}

export default function StravaPanel() {
  const { userId } = useUserId();
  const t = useT();
  const [busy, setBusy] = useState<BusyKind>(null);

  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const stravaConnectUrl = useMemo(() => {
    if (!userId || !API_URL) return null;
    return getStravaConnectUrl(userId, API_URL);
  }, [userId, API_URL]);

  const connected = !!status?.connected;
  const syncDays = status?.sync_import_window_days ?? null;
  const syncMax = status?.sync_import_max_activities ?? null;

  async function reloadStatus(uid: number) {
    setStatusLoading(true);
    try {
      const s = await apiGetStravaStatus(uid);
      setStatus(s);
    } catch (e: any) {
      console.error("[StravaPanel] status error:", t(e?.message as any));
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    if (!userId) {
      setStatus(null);
      return;
    }
    reloadStatus(userId);
  }, [userId]);

  useEffect(() => {
    const s = searchParams.get("strava");
    if (!s) return;

    const reason = searchParams.get("reason");
    const reconnectAfter = searchParams.get("reconnect_after");

    if (s === "ok") {
      toast.success(t("strava.toasts.connectSuccess"));
      if (userId) reloadStatus(userId);
    }

    if (s === "error") {
      if (reason === "athlete_already_linked") {
        toast.error(t("strava.toasts.errorAlreadyLinked"), Infinity);
      } else if (reason === "strava_athlete_limit") {
        toast.error(t("strava.toasts.errorLimit"), Infinity);
      } else if (reason === "reconnect_cooldown") {
        toast.error(
          reconnectAfter
            ? `${t("strava.toasts.reconnectAfter")} ${reconnectAfter}`
            : t("strava.toasts.reconnectCooldownDefault"),
          Infinity,
        );
      } else if (reason === "strava_denied") {
        toast.error(t("strava.toasts.errorDenied"));
      } else {
        toast.error(t("strava.toasts.errorGeneric"));
      }
    }

    router.replace(pathname);
  }, [searchParams, pathname, router, userId, t]);

  async function handleImportFromStrava() {
    if (!userId) return toast.error(t("common.errors.missingUserAuth"));
    if (busy) return;

    if (status?.can_manual_import !== true) {
      return toast.error(t("strava.toasts.importNotAllowed"));
    }

    const days = typeof syncDays === "number" && syncDays > 0 ? syncDays : 7;

    setBusy("import");
    try {
      const stats: SyncActivitiesStats = await apiSyncActivities(userId, {
        forceLastDays: days,
        fetchDetails: true,
      });

      const imp = stats.imported ?? 0;
      const upd = stats.updated ?? 0;
      const skp = stats.skipped ?? 0;

      // UX: Preložený súhrn importu
      toast.success(
        `${t("strava.toasts.importOk")} • ${t("strava.import.new")}: ${imp} • ${t("strava.import.updated")}: ${upd} • ${t("strava.import.skipped")}: ${skp}`,
      );

      await reloadStatus(userId);
    } catch (e: any) {
      const errorMsg = t(e?.message as any) || t("strava.toasts.importFailed");
      toast.error(errorMsg);
    } finally {
      setBusy(null);
    }
  }

  function openDisconnectModal() {
    setConfirmChecked(false);
    setShowDisconnectModal(true);
  }

  function closeDisconnectModal() {
    setShowDisconnectModal(false);
    setConfirmChecked(false);
  }

  async function handleDisconnectConfirmed() {
    if (!userId) return toast.error(t("common.errors.missingUserAuth"));
    if (busy) return;

    setBusy("disconnect");
    try {
      await apiDisconnectStrava(userId, {
        consent: true,
        reason: "user_request",
      });

      toast.success(t("strava.toasts.disconnectSuccess"));
      closeDisconnectModal();
      await reloadStatus(userId);
    } catch (e: any) {
      const errorMsg =
        t(e?.message as any) || t("strava.toasts.disconnectFailed");
      toast.error(errorMsg);
    } finally {
      setBusy(null);
    }
  }

  const disabled = !userId || busy !== null;

  const statusText = (() => {
    if (!userId) return t("strava.status.notLoggedIn");
    if (statusLoading) return t("strava.status.loading");
    return connected
      ? t("strava.status.connected")
      : t("strava.status.disconnected");
  })();

  const pillPaint = (() => {
    if (!userId || statusLoading) {
      return {
        borderColor: appColors.surfaceCardBorder,
        color: appColors.textSecondary,
        backgroundColor: "transparent",
      };
    }

    return connected
      ? {
          borderColor: "rgba(16, 185, 129, 0.55)",
          color: "rgba(167, 243, 208, 0.95)",
          backgroundColor: "rgba(16, 185, 129, 0.14)",
        }
      : {
          borderColor: "rgba(239, 68, 68, 0.55)",
          color: "rgba(254, 202, 202, 0.95)",
          backgroundColor: "rgba(239, 68, 68, 0.12)",
        };
  })();

  const canConnect = canConnectStravaNow(status);

  // Tlačidlo už nebude zablokované len preto, že stravaConnectUrl bolo null pre "undefined" ENV.
  const connectDisabled =
    disabled || !stravaConnectUrl || connected || statusLoading || !canConnect;

  const disconnectDisabled =
    disabled || !userId || !connected || statusLoading || busy === "disconnect";

  const importAllowed = status?.can_manual_import === true;
  const importDisabled =
    !userId || busy === "import" || !connected || !importAllowed;

  const reconnectAfterLabel = fmtIsoLocal(status?.reconnect_after ?? null);

  const syncWindowLabel =
    connected && typeof syncDays === "number" && syncDays > 0
      ? `${syncDays} ${t("common.units.days")}`
      : null;

  const syncMaxLabel =
    connected && typeof syncMax === "number" && syncMax > 0
      ? `${t("strava.sync.max")} ${syncMax} ${t("strava.sync.activities")}`
      : null;

  return (
    <>
      <section
        className={[PANEL, PANEL_PAD].join(" ")}
        style={{ ...SURFACE_INSET_STYLE, color: appColors.textPrimary }}
      >
        <header className={PANEL_HEADER}>
          <div>
            <h2
              className={PANEL_TITLE}
              style={{ color: appColors.textPrimary }}
            >
              {t("strava.title")}
            </h2>
            <p
              className={PANEL_SUBTITLE}
              style={{ color: appColors.textMuted }}
            >
              {t("strava.subtitle")}
            </p>

            {!connected && reconnectAfterLabel ? (
              <p
                className="text-[12px] mt-2"
                style={{ color: appColors.textMuted }}
              >
                {t("strava.reconnectAfterLabel")}{" "}
                <span style={{ color: appColors.textSecondary }}>
                  {reconnectAfterLabel}
                </span>
              </p>
            ) : null}

            {connected && (syncWindowLabel || syncMaxLabel) ? (
              <p
                className="text-[12px] mt-2"
                style={{ color: appColors.textMuted }}
              >
                {t("strava.syncWindowLabel")}{" "}
                <span style={{ color: appColors.textSecondary }}>
                  <b>{syncWindowLabel ?? "—"}</b>
                  {syncMaxLabel ? ` • ${syncMaxLabel}` : null}
                </span>
              </p>
            ) : null}
          </div>

          <div className={PANEL_STATUS_COL}>
            <span className={PANEL_STATUS_PILL} style={pillPaint}>
              {statusText}
            </span>

            <p
              className={PANEL_BRAND_TINY}
              style={{ color: appColors.textMuted }}
            >
              <img
                src={STRAVA_ASSETS.poweredBySvg_white}
                alt="Powered by Strava"
                style={{
                  height: 16,
                  width: "auto",
                  display: "block",
                  opacity: 0.9,
                }}
                draggable={false}
              />
            </p>
          </div>
        </header>

        <div className={PANEL_INNER_STACK}>
          {/* Sekcia 1 */}
          <div className={PANEL_SECTION}>
            <div
              className={PANEL_SECTION_LABEL}
              style={{ color: appColors.textSecondary }}
            >
              {t("strava.section1.label")}
            </div>
            <p
              className={PANEL_SECTION_TEXT}
              style={{ color: appColors.textMuted }}
            >
              {t("strava.section1.text")}
            </p>

            <div className={PANEL_ACTIONS_INLINE}>
              <Button
                variant="connectStrava"
                size="md"
                disabled={connectDisabled}
                onClick={() => {
                  if (!stravaConnectUrl || connectDisabled) return;
                  window.location.href = stravaConnectUrl;
                }}
                aria-label="Connect with Strava"
                title={
                  !canConnect && status?.reconnect_after
                    ? `${t("strava.reconnectAfterLabel")} ${status.reconnect_after}`
                    : "Connect with Strava"
                }
              />

              <Button
                size="sm"
                variant="disconnectStrava"
                disabled={disconnectDisabled}
                onClick={openDisconnectModal}
              >
                {busy === "disconnect" ? (
                  <span className="inline-flex items-center gap-1">
                    <LoadingSpinner size="button" />
                    {t("strava.disconnect.loading")}
                  </span>
                ) : (
                  t("strava.disconnect.button")
                )}
              </Button>
            </div>
          </div>

          {/* Sekcia 2 */}
          <div
            className={PANEL_SECTION + " " + PANEL_SECTION_DIVIDER}
            style={{ borderColor: appColors.divider }}
          >
            <div
              className={PANEL_SECTION_LABEL}
              style={{ color: appColors.textSecondary }}
            >
              {t("strava.section2.label")}
            </div>
            <p
              className={PANEL_SECTION_TEXT}
              style={{ color: appColors.textMuted }}
            >
              {t("strava.section2.text")}
              {importAllowed && syncWindowLabel ? (
                <>
                  {" "}
                  {t("strava.sync.currentWindow")}: <b>{syncWindowLabel}</b>
                  {syncMaxLabel ? (
                    <>
                      {" "}
                      • <b>{syncMaxLabel}</b>
                    </>
                  ) : null}
                  .
                </>
              ) : null}
            </p>

            <Button
              size="sm"
              variant="secondary"
              disabled={importDisabled}
              onClick={handleImportFromStrava}
            >
              {busy === "import" ? (
                <span className="inline-flex items-center gap-1">
                  <LoadingSpinner size="button" />
                  {t("strava.import.loading")}
                </span>
              ) : (
                `${t("strava.import.button")}${importAllowed && syncWindowLabel ? ` (${syncWindowLabel})` : ""}`
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Disconnect modal */}
      {showDisconnectModal && (
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
                  {t("strava.modal.title")}
                </div>
                <div
                  className="text-[12px] mt-1"
                  style={{ color: appColors.textMuted }}
                >
                  {t("strava.modal.warning")}
                </div>
              </div>

              <button
                type="button"
                onClick={closeDisconnectModal}
                className="text-xl leading-none opacity-70 hover:opacity-100"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div
              className="mt-3 text-sm"
              style={{ color: appColors.textMuted }}
            >
              {t("strava.modal.consequencesTitle")}
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>{t("strava.modal.consequence1")}</li>
                <li>{t("strava.modal.consequence2")}</li>
                <li>{t("strava.modal.consequence3")}</li>
              </ul>
            </div>

            <div className="mt-4">
              <Checkbox
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.currentTarget.checked)}
                label={
                  <span className="text-sm">
                    {t("strava.modal.consentLabel")}
                  </span>
                }
                hint={
                  <span className="text-[11px]">
                    {t("strava.modal.consentHint")}
                  </span>
                }
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={closeDisconnectModal}
                disabled={busy === "disconnect"}
              >
                {t("common.cancel")}
              </Button>

              <Button
                size="sm"
                variant="danger"
                disabled={!confirmChecked || busy === "disconnect"}
                onClick={handleDisconnectConfirmed}
                title={
                  !confirmChecked
                    ? t("strava.modal.btnDisabledTitle")
                    : t("strava.modal.btnAction")
                }
              >
                {busy === "disconnect" ? (
                  <span className="inline-flex items-center gap-1">
                    <LoadingSpinner size="button" />
                    {t("strava.disconnect.loading")}
                  </span>
                ) : (
                  t("strava.modal.btnAction")
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
