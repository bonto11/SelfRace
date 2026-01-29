"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import Button from "@/app/shared/ui/components/Button";
import { STRAVA_ASSETS } from "@/app/shared/ui/components/Strava";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { resetClientCache } from "@/app/shared/utils/resetClientCache";
import { apiSyncActivities } from "@/app/features/activities/api/synchronization";
import type { SyncActivitiesStats } from "@/app/features/activities/types/synchronization";
import { API_URL } from "@/app/shared/config";
import { apiGetStravaStatus, type StravaStatus, apiDisconnectStrava } from "../api/strava";

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

  const stravaConnectUrl = userId
    ? `${API_URL}/api/strava/oauth/start?user_id=${userId}`
    : null;

  const connected = !!status?.connected;

  /* ---------- STATUS ---------- */
  useEffect(() => {
    if (!userId) {
      setStatus(null);
      return;
    }

    setStatusLoading(true);
    apiGetStravaStatus(userId)
      .then(setStatus)
      .catch((e) => console.error("[StravaPanel] status error:", e))
      .finally(() => setStatusLoading(false));
  }, [userId]);

  /* ---------- OAUTH CALLBACK ---------- */
  useEffect(() => {
    const s = searchParams.get("strava");
    if (!s) return;

    const reason = searchParams.get("reason");

    if (s === "ok") {
      toast.success("Strava účet bol úspešne prepojený.");
      if (userId) {
        setStatusLoading(true);
        apiGetStravaStatus(userId)
          .then(setStatus)
          .finally(() => setStatusLoading(false));
      }
    }

    if (s === "error") {
      if (reason === "athlete_already_linked") {
        toast.error("Tento Strava účet je už pripojený k inému účtu.", Infinity);
      } else if (reason === "strava_denied") {
        toast.error("Pripojenie bolo zrušené na Strave.");
      } else {
        toast.error("Pripojenie Strava účtu zlyhalo.");
      }
    }

    router.replace(pathname);
  }, [searchParams, pathname, router, userId]);

  /* ---------- ACTIONS ---------- */

  async function handleDisconnectConfirmed() {
    if (!userId || busy) return;

    setBusy("disconnect");
    try {
      await apiDisconnectStrava(userId);
      toast.success("Strava účet bol odpojený. Dáta zo Stravy boli vymazané.");

      setShowDisconnectModal(false);
      setConfirmChecked(false);

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

  async function handleImportFromStrava() {
    if (!userId || busy) return;

    setBusy("import");
    try {
      const stats: SyncActivitiesStats = await apiSyncActivities(userId, {
        forceLastDays: 50,
        fetchDetails: true,
      });

      toast.success(
        `Import OK • nové: ${stats.imported ?? 0} • upravené: ${stats.updated ?? 0}`
      );
      resetClientCache();
    } catch (e: any) {
      toast.error(e?.message || "Import zo Stravy zlyhal.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReloadData() {
    if (busy) return;
    setBusy("reload");
    try {
      resetClientCache();
      toast.success("Dáta boli obnovené.");
    } finally {
      setBusy(null);
    }
  }

  const disabled = !userId || busy !== null;

  /* ---------- UI ---------- */

  return (
    <>
      <section
        className={[PANEL, PANEL_PAD].join(" ")}
        style={{ ...SURFACE_INSET_STYLE, color: appColors.textPrimary }}
      >
        <header className={PANEL_HEADER}>
          <div>
            <h2 className={PANEL_TITLE}>Strava</h2>
            <p className={PANEL_SUBTITLE}>
              Prepojenie účtu, import aktivít a správa dát.
            </p>
          </div>

          <div className={PANEL_STATUS_COL}>
            <span className={PANEL_STATUS_PILL}>
              {connected ? "Pripojené" : "Nepripojené"}
            </span>
            <p className={PANEL_BRAND_TINY}>
              <img
                src={STRAVA_ASSETS.poweredBySvg_white}
                alt="Powered by Strava"
                style={{ height: 16, opacity: 0.9 }}
              />
            </p>
          </div>
        </header>

        <div className={PANEL_INNER_STACK}>
          {/* PREPOJENIE */}
          <div className={PANEL_SECTION}>
            <div className={PANEL_SECTION_LABEL}>1. Prepojenie účtu</div>
            <p className={PANEL_SECTION_TEXT}>
              Pripoj alebo odpoj Stravu. Po odpojení budú dáta zo Stravy vymazané.
            </p>

            <div className={PANEL_ACTIONS_INLINE}>
              <Button
                variant="connectStrava"
                disabled={disabled || connected}
                onClick={() => {
                  if (!stravaConnectUrl) return;
                  window.location.href = stravaConnectUrl;
                }}
              />

              <Button
                size="sm"
                variant="disconnectStrava"
                disabled={disabled || !connected}
                onClick={() => setShowDisconnectModal(true)}
              >
                Odpojiť
              </Button>
            </div>
          </div>

          {/* IMPORT */}
          <div className={PANEL_SECTION + " " + PANEL_SECTION_DIVIDER}>
            <div className={PANEL_SECTION_LABEL}>2. Import zo Stravy</div>
            <p className={PANEL_SECTION_TEXT}>
              Manuálny import posledných aktivít (ak je povolený).
            </p>

            <Button
              size="sm"
              variant="secondary"
              disabled={!userId || busy === "import"}
              onClick={handleImportFromStrava}
            >
              {busy === "import" ? <LoadingSpinner size="button" /> : "Importovať"}
            </Button>
          </div>

          {/* RELOAD */}
          <div className={PANEL_SECTION + " " + PANEL_SECTION_DIVIDER}>
            <div className={PANEL_SECTION_LABEL}>3. Obnovenie dát</div>
            <p className={PANEL_SECTION_TEXT}>
              Vyčistí lokálnu cache a natiahne čerstvé dáta.
            </p>

            <Button
              size="sm"
              variant="secondary"
              disabled={!userId || busy === "reload"}
              onClick={handleReloadData}
            >
              {busy === "reload" ? <LoadingSpinner size="button" /> : "Obnoviť"}
            </Button>
          </div>
        </div>
      </section>

      {/* ---------- DISCONNECT MODAL ---------- */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg p-4 bg-[#111] border border-red-500/40">
            <h3 className="text-lg font-semibold mb-2 text-red-400">
              Odpojenie Stravy
            </h3>

            <p className="text-sm opacity-80 mb-3">
              Odpojením Stravy:
            </p>

            <ul className="text-sm opacity-80 list-disc ml-5 space-y-1 mb-3">
              <li>vymažeme všetky dáta importované zo Strava</li>
              <li>zrušíme autorizáciu a tokeny</li>
              <li>znovu pripojenie bude možné najskôr o 24 hodín</li>
              <li>import po opätovnom pripojení bude obmedzený</li>
            </ul>

            <label className="flex items-start gap-2 text-sm mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
              />
              <span>
                Rozumiem dôsledkom a súhlasím s vymazaním dát zo Stravy.
              </span>
            </label>

            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setShowDisconnectModal(false);
                  setConfirmChecked(false);
                }}
              >
                Zrušiť
              </Button>

              <Button
                size="sm"
                variant="danger"
                disabled={!confirmChecked || busy === "disconnect"}
                onClick={handleDisconnectConfirmed}
              >
                {busy === "disconnect" ? (
                  <LoadingSpinner size="button" />
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