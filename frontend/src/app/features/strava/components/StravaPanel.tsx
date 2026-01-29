"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import { STRAVA_ASSETS } from "@/app/shared/ui/components/Strava";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { resetClientCache } from "@/app/shared/utils/resetClientCache";
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

type BusyKind = "reload" | "import" | "disconnect" | null;

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

  const stravaConnectUrl = useMemo(() => {
    if (!userId) return null;
    return getStravaConnectUrl(userId, API_URL);
  }, [userId]);

  const connected = !!status?.connected;

  // --- načítanie statusu ---
  useEffect(() => {
    if (!userId) {
      setStatus(null);
      return;
    }

    setStatusLoading(true);
    apiGetStravaStatus(userId)
      .then((s) => setStatus(s))
      .catch((e) => console.error("[StravaPanel] status error:", e))
      .finally(() => setStatusLoading(false));
  }, [userId]);

  // --- callback z OAuth (?strava=ok|error) ---
  useEffect(() => {
    const s = searchParams.get("strava");
    if (!s) return;

    const reason = searchParams.get("reason");

    if (s === "ok") {
      toast.success("Strava účet bol úspešne prepojený.");
      if (userId) {
        setStatusLoading(true);
        apiGetStravaStatus(userId)
          .then((st) => setStatus(st))
          .catch((e) => console.error("[StravaPanel] status reload error:", e))
          .finally(() => setStatusLoading(false));
      }
    }

    if (s === "error") {
      if (reason === "athlete_already_linked") {
        toast.error("Tento Strava účet je už pripojený k inému účtu.", Infinity);
      } else if (reason === "strava_denied") {
        toast.error("Pripojenie bolo zrušené na Strave.");
      } else {
        toast.error("Pripojenie Strava účtu zlyhalo. Skús to znova.");
      }
    }

    router.replace(pathname);
  }, [searchParams, pathname, router, userId]);

  async function handleReloadData() {
    if (busy) return;
    setBusy("reload");
    try {
      resetClientCache();
      toast.success("Dáta boli znovu načítané.");
    } catch (e: any) {
      toast.error(e?.message || "Nepodarilo sa reloadnúť dáta.");
    } finally {
      setBusy(null);
    }
  }

  async function handleImportFromStrava() {
    if (!userId) {
      toast.error("Chýba user id – skús sa znova prihlásiť.");
      return;
    }
    if (busy) return;

    // ✅ teraz držíme v FE pravidlo, že default je 50 dní,
    // a po “disconnect+reconnect” (keď BE začne posielať manual_import_window_days)
    // to automaticky spadne na 7.
    const windowDays =
      typeof status?.manual_import_window_days === "number"
        ? status!.manual_import_window_days!
        : 50;

    setBusy("import");
    try {
      const stats: SyncActivitiesStats = await apiSyncActivities(userId, {
        forceLastDays: windowDays,
        fetchDetails: true,
      });

      const imp = stats.imported ?? 0;
      const upd = stats.updated ?? 0;
      const skp = stats.skipped ?? 0;

      toast.success(
        `Import zo Stravy OK • nové: ${imp} • upravené: ${upd} • preskočené: ${skp}`
      );
      resetClientCache();
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
    if (!userId) {
      toast.error("Chýba user id – skús sa znova prihlásiť.");
      return;
    }
    if (busy) return;

    setBusy("disconnect");
    try {
      // ✅ nové API: vyžaduje consent payload
      await apiDisconnectStrava(userId, { consent: true, reason: "user_request" });

      toast.success("Strava účet bol odpojený. Dáta zo Stravy boli vymazané.");
      closeDisconnectModal();

      setStatusLoading(true);
      await apiGetStravaStatus(userId).then(setStatus);
      resetClientCache();
    } catch (e: any) {
      toast.error(e?.message || "Odpojenie Stravy zlyhalo.");
    } finally {
      setStatusLoading(false);
      setBusy(null);
    }
  }

  const disabled = !userId || busy !== null;

  const canConnectNow = canConnectStravaNow(status);

  // Pill text
  const statusText = (() => {
    if (!userId) return "Neprihlásený";
    if (statusLoading) return "Kontrolujem…";
    if (connected) return "Pripojené";
    if (status?.reconnect_after && !canConnectNow) return "Čaká 24h";
    return "Nepripojené";
  })();

  // Pill colors
  const pillPaint = (() => {
    if (!userId || statusLoading) {
      return {
        borderColor: appColors.surfaceCardBorder,
        color: appColors.textSecondary,
        backgroundColor: "transparent",
      };
    }

    if (connected) {
      return {
        borderColor: "rgba(16, 185, 129, 0.55)",
        color: "rgba(167, 243, 208, 0.95)",
        backgroundColor: "rgba(16, 185, 129, 0.14)",
      };
    }

    // ak je “cooldown”
    if (status?.reconnect_after && !canConnectNow) {
      return {
        borderColor: "rgba(245, 158, 11, 0.55)", // amber-ish
        color: "rgba(253, 230, 138, 0.95)",
        backgroundColor: "rgba(245, 158, 11, 0.12)",
      };
    }

    return {
      borderColor: "rgba(239, 68, 68, 0.55)",
      color: "rgba(254, 202, 202, 0.95)",
      backgroundColor: "rgba(239, 68, 68, 0.12)",
    };
  })();

  // connect – blokujeme aj keď je cooldown
  const connectDisabled =
    disabled || !stravaConnectUrl || connected || statusLoading || !canConnectNow;

  const disconnectDisabled =
    disabled || !userId || !connected || statusLoading || busy === "disconnect";

  const importWindowDays =
    typeof status?.manual_import_window_days === "number"
      ? status!.manual_import_window_days!
      : 50;

  const importDisabled =
    !userId ||
    !connected || // import len keď je pripojené
    busy === "import" ||
    statusLoading;

  const importText =
    importWindowDays === 7
      ? "Manuálny import je po opätovnom pripojení obmedzený na 7 dní."
      : "Manuálny import približne posledných 50 dní alebo max. ~200 najnovších aktivít.";

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
              Prepojenie účtu, manuálny import aktivít a obnovenie cache.
            </p>
          </div>

          <div className={PANEL_STATUS_COL}>
            <span className={PANEL_STATUS_PILL} style={pillPaint}>
              {statusText}
            </span>

            <p className={PANEL_BRAND_TINY} style={{ color: appColors.textMuted }}>
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
              1. Prepojenie účtu
            </div>

            <p className={PANEL_SECTION_TEXT} style={{ color: appColors.textMuted }}>
              Pripoj alebo odpoj Stravu. Pri pripojení sa otvorí autorizácia a po
              potvrdení sa vrátiš späť.
            </p>

            {/* Cooldown hint */}
            {!connected && status?.reconnect_after && !canConnectNow && (
              <div className="text-[12px] mt-2" style={{ color: appColors.textMuted }}>
                Opätovné pripojenie je možné najskôr od:{" "}
                <span className="font-semibold" style={{ color: appColors.textPrimary }}>
                  {status.reconnect_after}
                </span>
              </div>
            )}

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
                  !canConnectNow
                    ? "Opätovné pripojenie je dočasne blokované po odpojení."
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
            <div
              className={PANEL_SECTION_LABEL}
              style={{ color: appColors.textSecondary }}
            >
              2. Import zo Stravy
            </div>

            <p className={PANEL_SECTION_TEXT} style={{ color: appColors.textMuted }}>
              {importText}
            </p>

            <Button
              size="sm"
              variant="secondary"
              disabled={importDisabled}
              onClick={handleImportFromStrava}
              title={!connected ? "Najprv pripoj Stravu." : "Spustiť import zo Stravy"}
            >
              {busy === "import" ? (
                <span className="inline-flex items-center gap-1">
                  <LoadingSpinner size="button" />
                  Importujem…
                </span>
              ) : (
                "Importovať"
              )}
            </Button>
          </div>

          {/* Sekcia 3 */}
          <div
            className={PANEL_SECTION + " " + PANEL_SECTION_DIVIDER}
            style={{ borderColor: appColors.divider }}
          >
            <div
              className={PANEL_SECTION_LABEL}
              style={{ color: appColors.textSecondary }}
            >
              3. Obnovenie dát
            </div>
            <p className={PANEL_SECTION_TEXT} style={{ color: appColors.textMuted }}>
              Vyčistí lokálnu cache (aktivity, plány, prefs) a natiahne čerstvé dáta.
            </p>

            <Button
              size="sm"
              variant="secondary"
              disabled={!userId || busy === "reload"}
              onClick={handleReloadData}
            >
              {busy === "reload" ? (
                <span className="inline-flex items-center gap-1">
                  <LoadingSpinner size="button" />
                  Obnovujem…
                </span>
              ) : (
                "Obnoviť"
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
                <li>zrušíme autorizáciu a uložené tokeny</li>
                <li>znovu pripojenie bude možné najskôr o 24 hodín</li>
                <li>po opätovnom pripojení bude manuálny import obmedzený (kvôli ochrane kvót celej aplikácie)</li>
              </ul>
            </div>

            <div className="mt-4">
              <Checkbox
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.currentTarget.checked)}
                label={
                  <span className="text-sm">
                    Rozumiem dôsledkom a súhlasím s vymazaním dát zo Stravy.
                  </span>
                }
                hint={
                  <span className="text-[11px]">
                    Toto obmedzenie pomáha chrániť kvóty celej aplikácie (všetkých používateľov).
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
                Zrušiť
              </Button>

              <Button
                size="sm"
                variant="danger"
                disabled={!confirmChecked || busy === "disconnect"}
                onClick={handleDisconnectConfirmed}
                title={
                  !confirmChecked
                    ? "Zaškrtni súhlas, aby sa odpojenie povolilo."
                    : "Odpojiť Stravu"
                }
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