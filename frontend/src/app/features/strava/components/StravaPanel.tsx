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
          Infinity
        );
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
        forceLastDays: 50, // BE má ešte cap na ~200 aktivít
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

      // refresh status + cache
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

  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-black/20 px-4 py-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Strava</h2>
          <p className="mt-1 text-xs opacity-70">
            Prepojenie účtu, reload cache a manuálny import aktivít.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide opacity-80">
            {statusLabel}
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
            Powered by Strava
          </p>
        </div>
      </header>

      <div className="space-y-3 text-sm">
        {/* 1) Connect with Strava */}
        <div className="space-y-1">
          <div className="text-xs font-semibold opacity-80">
            1. Prepojenie účtu
          </div>
          <p className="text-xs opacity-70">
            Otvorí oficiálne Strava okno na prihlásenie. Po potvrdení ťa Strava
            presmeruje späť do aplikácie.
          </p>
          <Button
            size="sm"
            variant="primary"
            disabled={!stravaConnectUrl || disabled}
            onClick={() => {
              if (!stravaConnectUrl || disabled) return;
              window.location.href = stravaConnectUrl;
            }}
          >
            Connect with Strava
          </Button>
        </div>

        {/* 4) Disconnect */}
        {status?.connected ? (
          <div className="space-y-1 border-t border-white/10 pt-2">
            <div className="text-xs font-semibold opacity-80">4. Odpojenie</div>
            <p className="text-xs opacity-70">
              Zruší autorizáciu na Strave a vymaže tokeny uložené v aplikácii.
            </p>

            <Button
              size="sm"
              variant="secondary"
              disabled={busy === "disconnect" || !userId}
              onClick={handleDisconnectStrava}
            >
              {busy === "disconnect" ? (
                <span className="inline-flex items-center gap-1">
                  <LoadingSpinner size="button" />
                  Odpájam…
                </span>
              ) : (
                "Disconnect Strava"
              )}
            </Button>
          </div>
        ) : null}

        {/* 2) Reload cache */}
        <div className="space-y-1 border-t border-white/10 pt-2">
          <div className="text-xs font-semibold opacity-80">2. Reload dát</div>
          <p className="text-xs opacity-70">
            Vyčistí lokálnu cache (aktivity, plány, prefs) a natiahne čerstvé
            dáta z backendu.
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy === "reload" || !userId}
            onClick={handleReloadData}
          >
            {busy === "reload" ? (
              <span className="inline-flex items-center gap-1">
                <LoadingSpinner size="button" />
                Reloadujem…
              </span>
            ) : (
              "Reload data"
            )}
          </Button>
        </div>

        {/* 3) Manuálny import */}
        <div className="space-y-1 border-t border-white/10 pt-2">
          <div className="text-xs font-semibold opacity-80">
            3. Import zo&nbsp;Stravy
          </div>
          <p className="text-xs opacity-70">
            Manuálny import približne posledných 50 dní alebo max. ~200
            najnovších aktivít. Existujúce záznamy sa aktualizujú, nové sa
            vytvoria.
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy === "import" || !userId}
            onClick={handleImportFromStrava}
          >
            {busy === "import" ? (
              <span className="inline-flex items-center gap-1">
                <LoadingSpinner size="button" />
                Importujem…
              </span>
            ) : (
              "Import from Strava"
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
