"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/CheckBox";
import { STRAVA_ASSETS } from "@/app/shared/ui/components/Strava";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { apiSyncActivities } from "@/app/features/activities/api/synchronization";
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

type BusyKind = "import" | "disconnect" | null;

function fmtIsoLocal(iso?: string | null): string | null {
  if (!iso) return null;
  // necháme to jednoduché: zobrazíme raw ISO (backend už posiela ISO-ish)
  return iso;
}

export default function StravaPanel() {
  const { userId } = useUserId();
  const [busy, setBusy] = useState<BusyKind>(null);

  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const apiUrlSafe = API_URL ?? "";

  const stravaConnectUrl = useMemo(() => {
    if (!userId || !apiUrlSafe) return null;
    return getStravaConnectUrl(userId, apiUrlSafe);
  }, [userId, apiUrlSafe]);

  const connected = !!status?.connected;

  // ✅ nové čísla zo statusu (žiadne staré manual_import_window_days)
  const syncDays = status?.sync_import_window_days ?? null;
  const syncMax = status?.sync_import_max_activities ?? null;

  async function reloadStatus(uid: number) {
    setStatusLoading(true);
    try {
      const s = await apiGetStravaStatus(uid);
      setStatus(s);
    } catch (e) {
      console.error("[StravaPanel] status error:", e);
    } finally {
      setStatusLoading(false);
    }
  }

  // --- load status ---
  useEffect(() => {
    if (!userId) {
      setStatus(null);
      return;
    }
    reloadStatus(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // --- OAuth callback (?strava=ok|error) ---
  useEffect(() => {
    const s = searchParams.get("strava");
    if (!s) return;

    const reason = searchParams.get("reason");
    const reconnectAfter = searchParams.get("reconnect_after");

    if (s === "ok") {
      toast.success("Strava účet bol úspešne prepojený.");
      if (userId) reloadStatus(userId);
    }

    if (s === "error") {
      if (reason === "athlete_already_linked") {
        toast.error("Tento Strava účet je už pripojený k inému účtu.", Infinity);
      } else if (reason === "strava_athlete_limit") {
        toast.error(
          "Strava limit: aplikácia je zatiaľ v test režime (limit pripojených účtov).",
          Infinity
        );
      } else if (reason === "reconnect_cooldown") {
        toast.error(
          reconnectAfter
            ? `Znovu pripojenie je možné najskôr po: ${reconnectAfter}`
            : "Znovu pripojenie je možné až po 24 hodinách.",
          Infinity
        );
      } else if (reason === "strava_denied") {
        toast.error("Pripojenie bolo zrušené na Strave.");
      } else {
        toast.error("Pripojenie Strava účtu zlyhalo. Skús to znova.");
      }
    }

    router.replace(pathname);
  }, [searchParams, pathname, router, userId]);

  async function handleImportFromStrava() {
    if (!userId) return toast.error("Chýba user id – skús sa znova prihlásiť.");
    if (busy) return;

    // ✅ BE rozhoduje, či import povolí
    if (status?.can_manual_import !== true) {
      return toast.error("Manuálny import nie je momentálne povolený.");
    }

    // ✅ používa sa iba nové okno zo statusu
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

      toast.success(`Import zo Stravy OK • nové: ${imp} • upravené: ${upd} • preskočené: ${skp}`);

      // po importe refresh status (nech sedí aj "sync okno" / info)
      await reloadStatus(userId);
    } catch (e: any) {
      toast.error(e?.message || "Import zo Stravy zlyhal.");
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
    if (!userId) return toast.error("Chýba user id – skús sa znova prihlásiť.");
    if (busy) return;

    setBusy("disconnect");
    try {
      await apiDisconnectStrava(userId, { consent: true, reason: "user_request" });

      toast.success("Strava účet bol odpojený. Dáta zo Stravy boli vymazané.");
      closeDisconnectModal();

      await reloadStatus(userId);

      // pozor: status sa práve reloadol, takže čítaj z reloadnutého stavu cez fresh call
      // (jednoducho: ukáž reconnect_after z aktuálneho statusu ak existuje)
    } catch (e: any) {
      toast.error(e?.message || "Odpojenie Stravy zlyhalo.");
    } finally {
      setBusy(null);
    }
  }

  const disabled = !userId || busy !== null;

  const statusText = (() => {
    if (!userId) return "Neprihlásený";
    if (statusLoading) return "Kontrolujem…";
    return connected ? "Pripojené" : "Nepripojené";
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
  const connectDisabled =
    disabled || !stravaConnectUrl || connected || statusLoading || !canConnect;

  const disconnectDisabled =
    disabled || !userId || !connected || statusLoading || busy === "disconnect";

  // ✅ Import default disabled; iba keď BE explicitne povolí
  const importAllowed = status?.can_manual_import === true;

  // ✅ ak nemáme číslo okna, stále dovolíme klik (days fallback 7), ale len keď BE povolí
  const importDisabled = !userId || busy === "import" || !connected || !importAllowed;

  const reconnectAfterLabel = fmtIsoLocal(status?.reconnect_after ?? null);

  const syncWindowLabel =
    connected && typeof syncDays === "number" && syncDays > 0
      ? `${syncDays} dní`
      : null;

  const syncMaxLabel =
    connected && typeof syncMax === "number" && syncMax > 0 ? `max ${syncMax} aktivít` : null;

  return (
    <>
      <section
        className={[PANEL, PANEL_PAD].join(" ")}
        style={{ ...SURFACE_INSET_STYLE, color: appColors.textPrimary }}
      >
        <header className={PANEL_HEADER}>
          <div>
            <h2 className={PANEL_TITLE} style={{ color: appColors.textPrimary }}>
              Strava
            </h2>
            <p className={PANEL_SUBTITLE} style={{ color: appColors.textMuted }}>
              Prepojenie účtu a manuálny import aktivít.
            </p>

            {!connected && reconnectAfterLabel ? (
              <p className="text-[12px] mt-2" style={{ color: appColors.textMuted }}>
                Znovu pripojenie možné najskôr po:{" "}
                <span style={{ color: appColors.textSecondary }}>{reconnectAfterLabel}</span>
              </p>
            ) : null}

            {connected && (syncWindowLabel || syncMaxLabel) ? (
              <p className="text-[12px] mt-2" style={{ color: appColors.textMuted }}>
                Sync okno:{" "}
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

            <p className={PANEL_BRAND_TINY} style={{ color: appColors.textMuted }}>
              <img
                src={STRAVA_ASSETS.poweredBySvg_white}
                alt="Powered by Strava"
                style={{ height: 16, width: "auto", display: "block", opacity: 0.9 }}
                draggable={false}
              />
            </p>
          </div>
        </header>

        <div className={PANEL_INNER_STACK}>
          {/* Sekcia 1 */}
          <div className={PANEL_SECTION}>
            <div className={PANEL_SECTION_LABEL} style={{ color: appColors.textSecondary }}>
              1. Prepojenie účtu
            </div>
            <p className={PANEL_SECTION_TEXT} style={{ color: appColors.textMuted }}>
              Pripoj alebo odpoj Stravu. Pri pripojení sa otvorí autorizácia a po potvrdení sa vrátiš späť.
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
                    ? `Znovu pripojenie možné po: ${status.reconnect_after}`
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
                    Odpájam…
                  </span>
                ) : (
                  "Odpojiť"
                )}
              </Button>
            </div>
          </div>

          {/* Sekcia 2 */}
          <div
            className={PANEL_SECTION + " " + PANEL_SECTION_DIVIDER}
            style={{ borderColor: appColors.divider }}
          >
            <div className={PANEL_SECTION_LABEL} style={{ color: appColors.textSecondary }}>
              2. Import zo Stravy
            </div>
            <p className={PANEL_SECTION_TEXT} style={{ color: appColors.textMuted }}>
              Manuálny import je štandardne vypnutý a povoľuje sa len v špecifických prípadoch (riadi backend).
              {importAllowed && syncWindowLabel ? (
                <>
                  {" "}Aktuálne okno: <b>{syncWindowLabel}</b>
                  {syncMaxLabel ? <> • <b>{syncMaxLabel}</b></> : null}.
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
                  Importujem…
                </span>
              ) : (
                `Importovať${importAllowed && syncWindowLabel ? ` (${syncWindowLabel})` : ""}`
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* ===== Disconnect modal (2-step: checkbox -> enable) ===== */}
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
                  Odpojenie Stravy
                </div>
                <div className="text-[12px] mt-1" style={{ color: appColors.textMuted }}>
                  Toto je nevratná akcia.
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

            <div className="mt-3 text-sm" style={{ color: appColors.textMuted }}>
              Odpojením Stravy:
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>vymažeme všetky dáta importované zo Stravy (aktivity, streamy, splits/laps)</li>
                <li>zrušíme autorizáciu</li>
                <li>znovu pripojenie bude možné najskôr o 24 hodín</li>
              </ul>
            </div>

            <div className="mt-4">
              <Checkbox
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.currentTarget.checked)}
                label={
                  <span className="text-sm">
                    Rozumiem dôsledkom a súhlasím s vymazaním dát importovaných zo Stravy v tejto aplikácii.
                  </span>
                }
                hint={<span className="text-[11px]">Bez tohto súhlasu odpojenie nepovolíme.</span>}
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={closeDisconnectModal}
                disabled={busy === "disconnect"}
              >
                Zrušiť
              </Button>

              <Button
                size="sm"
                variant="danger"
                disabled={!confirmChecked || busy === "disconnect"}
                onClick={handleDisconnectConfirmed}
                title={!confirmChecked ? "Zaškrtni súhlas, aby sa odpojenie povolilo." : "Odpojiť Stravu"}
              >
                {busy === "disconnect" ? (
                  <span className="inline-flex items-center gap-1">
                    <LoadingSpinner size="button" />
                    Odpájam…
                  </span>
                ) : (
                  "Odpojiť Stravu"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}