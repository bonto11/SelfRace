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
import { confirm } from "@/app/shared/ui/components/Confirm";
import { API_URL } from "@/app/shared/config";
import {
  apiGetStravaStatus,
  type StravaStatus,
  apiDisconnectStrava,
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

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const stravaConnectUrl = userId
    ? `${API_URL}/api/strava/oauth/start?user_id=${userId}`
    : null;

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
      .catch((e) => {
        console.error("[StravaPanel] status error:", e);
      })
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
        toast.error(
          "Tento Strava účet je už pripojený k inému účtu.",
          Infinity,
        );
      } else if (reason === "strava_athlete_limit") {
        toast.error(
          "Strava limit: aplikácia je zatiaľ v test režime (1 pripojený účet).",
          Infinity,
        );
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

    const step1 = await confirm({
      title: "Importovať aktivity zo Stravy?",
      message:
        "Spustí sa import priblížne posledných 50 dní alebo max. ~200 najnovších aktivít (vrátane detailov). Môže to chvíľu trvať.",
      okText: "Pokračovať",
      cancelText: "Zrušiť",
    });
    if (!step1) return;

    const step2 = await confirm({
      title: "Naozaj spustiť import?",
      message:
        "Existujúce záznamy sa len aktualizujú (import/update/skipped). Nevymažeme nič, ale import môže chvíľu bežať.",
      okText: "Spustiť import",
      cancelText: "Zrušiť",
      tone: "danger",
    });
    if (!step2) return;

    setBusy("import");
    try {
      const stats: SyncActivitiesStats = await apiSyncActivities(userId, {
        forceLastDays: 50,
        fetchDetails: true,
      });

      const imp = stats.imported ?? 0;
      const upd = stats.updated ?? 0;
      const skp = stats.skipped ?? 0;

      toast.success(
        `Import zo Stravy OK • nové: ${imp} • upravené: ${upd} • preskočené: ${skp}`,
      );

      resetClientCache();
    } catch (e: any) {
      toast.error(e?.message || "Import zo Stravy zlyhal.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnectStrava() {
    if (!userId) {
      toast.error("Chýba user id – skús sa znova prihlásiť.");
      return;
    }
    if (busy) return;

    const step1 = await confirm({
      title: "Odpojiť Stravu?",
      message:
        "Odpojíme Strava účet od SelfRace. Zruší sa autorizácia na Strave a vymažeme uložené tokeny. Import a webhooky prestanú fungovať.",
      okText: "Odpojiť",
      cancelText: "Zrušiť",
      tone: "danger",
    });
    if (!step1) return;

    const step2 = await confirm({
      title: "Naozaj odpojiť Stravu?",
      message:
        "Toto je bezpečnostný krok. Po odpojení bude treba znovu autorizovať prístup.",
      okText: "Áno, odpojiť",
      cancelText: "Zrušiť",
      tone: "danger",
    });
    if (!step2) return;

    setBusy("disconnect");
    try {
      await apiDisconnectStrava(userId);
      toast.success("Strava účet bol odpojený.");

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

  const statusLabel = (() => {
    if (!userId) return "Neprihlásený";
    if (statusLoading) return "Kontrolujem…";
    if (!status || !status.connected) return "Neprepojené";
    return `Prepojené (athlete #${status.athlete_id})`;
  })();

  // --- Connect/Disconnect disabled rules (presne ako chceš) ---
  const connectDisabled =
    disabled || !stravaConnectUrl || connected || statusLoading;

  const disconnectDisabled =
    disabled || !userId || !connected || statusLoading || busy === "disconnect";
  return (
    <section
      className={[PANEL, PANEL_PAD].join(" ")}
      style={{
        ...SURFACE_INSET_STYLE,
        color: appColors.textPrimary,
      }}
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
          <span
            className={PANEL_STATUS_PILL}
            style={{
              borderColor: appColors.surfaceCardBorder,
              color: appColors.textSecondary,
            }}
          >
            {statusLabel}
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
            1. Prepojenie účtu
          </div>
          <p
            className={PANEL_SECTION_TEXT}
            style={{ color: appColors.textMuted }}
          >
            Pripoj alebo odpoj Stravu. Pri pripojení sa otvorí autorizácia a po
            potvrdení sa vrátiš späť.
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
              title="Connect with Strava"
            />

            <Button
              size="sm"
              variant="disconnectStrava"
              disabled={disconnectDisabled}
              onClick={handleDisconnectStrava}
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
          <p
            className={PANEL_SECTION_TEXT}
            style={{ color: appColors.textMuted }}
          >
            Manuálny import približne posledných 50 dní alebo max. ~200
            najnovších aktivít.
          </p>

          <Button
            size="sm"
            variant="secondary"
            disabled={!userId || busy === "import"}
            onClick={handleImportFromStrava}
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
          <p
            className={PANEL_SECTION_TEXT}
            style={{ color: appColors.textMuted }}
          >
            Vyčistí lokálnu cache (aktivity, plány, prefs) a natiahne čerstvé
            dáta.
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
  );
}
