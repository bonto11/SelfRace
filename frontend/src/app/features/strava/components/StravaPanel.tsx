"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import Button from "@/app/shared/components/ui/Button";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { toast } from "@/app/shared/components/ui/Toast";
import { resetClientCache } from "@/app/shared/utils/resetClientCache";
import { apiSyncActivities } from "@/app/features/activities/api/synchronization";
import type { SyncActivitiesStats } from "@/app/features/activities/types/synchronization";
import { confirm } from "@/app/shared/components/ui/Confirm";
import { API_URL } from "@/app/shared/config";
import {
  apiGetStravaStatus,
  type StravaStatus,
  apiDisconnectStrava,
} from "../api/strava";

import { appColors } from "@/app/shared/theme/app_colors";
import {
  PANEL,
  PANEL_STACK,
  PANEL_HEADER,
  PANEL_TITLE,
  PANEL_SUBTITLE,
  PANEL_STATUS_COL,
  PANEL_STATUS_PILL,
  PANEL_BRAND_TINY,
  PANEL_SECTION,
  PANEL_SECTION_DIVIDER,
  PANEL_SECTION_LABEL,
  PANEL_SECTION_TEXT,
  PANEL_ACTIONS_INLINE,
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
        toast.error("Tento Strava účet je už pripojený k inému účtu.", Infinity);
      } else if (reason === "strava_athlete_limit") {
        toast.error(
          "Strava limit: aplikácia je zatiaľ v test režime (1 pripojený účet).",
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
        `Import zo Stravy OK • nové: ${imp} • upravené: ${upd} • preskočené: ${skp}`
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
      className={[PANEL, PANEL_STACK].join(" ")}
      style={{
        background: appColors.surfaceCard,
        borderColor: appColors.surfaceCardBorder,
      }}
    >
      <header className={PANEL_HEADER}>
        <div>
          <h2 className={PANEL_TITLE} style={{ color: appColors.textPrimary }}>
            Strava
          </h2>
          <p className={PANEL_SUBTITLE} style={{ color: appColors.textMuted }}>
            Prepojenie účtu, manuálny import aktivít a reload cache.
          </p>
        </div>

        <div className={PANEL_STATUS_COL}>
          <span
            className={PANEL_STATUS_PILL}
            style={{
              borderColor: appColors.pillBorder,
              color: appColors.textSecondary,
              background: appColors.pillBg,
              opacity: 0.95,
            }}
          >
            {statusLabel}
          </span>
          <span className={PANEL_BRAND_TINY} style={{ color: appColors.textMuted }}>
            Powered by Strava
          </span>
        </div>
      </header>

      <div className="space-y-3 text-sm">
        {/* 1) Connect / Disconnect inline */}
        <div className={PANEL_SECTION}>
          <div className={PANEL_SECTION_LABEL} style={{ color: appColors.textSecondary }}>
            1. Prepojenie účtu
          </div>
          <p className={PANEL_SECTION_TEXT} style={{ color: appColors.textMuted }}>
            Pripoj alebo odpoj Stravu. Pri pripojení sa otvorí Strava autorizácia a
            po potvrdení sa vrátiš späť do aplikácie.
          </p>

          <div className={PANEL_ACTIONS_INLINE}>
            <Button
              size="sm"
              variant="primary"
              disabled={connectDisabled}
              onClick={() => {
                if (connectDisabled || !stravaConnectUrl) return;
                window.location.href = stravaConnectUrl;
              }}
              title={connected ? "Strava už je pripojená" : undefined}
            >
              Connect
            </Button>

            <Button
              size="sm"
              variant="secondary"
              disabled={disconnectDisabled}
              onClick={handleDisconnectStrava}
              title={!connected ? "Najprv pripoj Stravu" : undefined}
            >
              {busy === "disconnect" ? (
                <span className="inline-flex items-center gap-1">
                  <LoadingSpinner size="button" />
                  Odpájam…
                </span>
              ) : (
                "Disconnect"
              )}
            </Button>
          </div>
        </div>

        {/* 2) Import */}
        <div
          className={[PANEL_SECTION, PANEL_SECTION_DIVIDER].join(" ")}
          style={{ borderColor: appColors.divider }}
        >
          <div className={PANEL_SECTION_LABEL} style={{ color: appColors.textSecondary }}>
            2. Import zo Stravy
          </div>
          <p className={PANEL_SECTION_TEXT} style={{ color: appColors.textMuted }}>
            Manuálny import približne posledných 50 dní alebo max. ~200 aktivít. Existujúce
            záznamy sa aktualizujú, nové sa vytvoria.
          </p>

          <Button
            size="sm"
            variant="secondary"
            disabled={busy === "import" || !userId || statusLoading}
            onClick={handleImportFromStrava}
          >
            {busy === "import" ? (
              <span className="inline-flex items-center gap-1">
                <LoadingSpinner size="button" />
                Importujem…
              </span>
            ) : (
              "Import"
            )}
          </Button>
        </div>

        {/* 3) Reload cache */}
        <div
          className={[PANEL_SECTION, PANEL_SECTION_DIVIDER].join(" ")}
          style={{ borderColor: appColors.divider }}
        >
          <div className={PANEL_SECTION_LABEL} style={{ color: appColors.textSecondary }}>
            3. Reload dát
          </div>
          <p className={PANEL_SECTION_TEXT} style={{ color: appColors.textMuted }}>
            Vyčistí lokálnu cache (aktivity, plány, prefs) a natiahne čerstvé dáta.
          </p>

          <Button
            size="sm"
            variant="secondary"
            disabled={busy === "reload" || !userId || statusLoading}
            onClick={handleReloadData}
          >
            {busy === "reload" ? (
              <span className="inline-flex items-center gap-1">
                <LoadingSpinner size="button" />
                Reloadujem…
              </span>
            ) : (
              "Reload"
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}