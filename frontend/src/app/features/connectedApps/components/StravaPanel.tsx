"use client";

import { useState } from "react";

import { useUserId } from "@/app/shared/hooks/useUserId";
import Button from "@/app/shared/components/ui/Button";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { toast } from "@/app/shared/components/ui/Toast";
import { resetClientCache } from "@/app/shared/utils/resetClientCache";
import { apiSyncActivities } from "@/app/features/activities/api/synchronization";
import type { SyncActivitiesStats } from "@/app/features/activities/types/synchronization";
import { confirm } from "@/app/shared/components/ui/Confirm";
import { API_URL } from "@/app/shared/config";

type BusyKind = "reload" | "import" | null;

export default function StravaPanel() {
  const { userId } = useUserId();
  const [busy, setBusy] = useState<BusyKind>(null);

  const stravaConnectUrl = userId
    ? `${API_URL}/api/strava/oauth/start?user_id=${userId}`
    : null;

  async function handleReloadData() {
    if (busy) return;
    setBusy("reload");
    try {
      resetClientCache();
      toast.success("Reloaded data.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to reload data.");
    } finally {
      setBusy(null);
    }
  }

  async function handleImportFromStrava() {
    if (!userId) {
      toast.error("Missing user id.");
      return;
    }
    if (busy) return;

    // 1. krok – jemné potvrdenie
    const step1 = await confirm({
      title: "Importovať aktivity zo Stravy?",
      message:
        "Spustí sa import posledných 30 dní aktivít (vrátane detailov). Môže to chvíľu trvať.",
      okText: "Pokračovať",
      cancelText: "Zrušiť",
    });
    if (!step1) return;

    // 2. krok – „are you sure“ s danger tónom
    const step2 = await confirm({
      title: "Naozaj spustiť import?",
      message:
        "Ak máš veľa aktivít, import môže chvíľu bežať a prepíše staré záznamy (import/update/skipped).",
      okText: "Spustiť import",
      cancelText: "Zrušiť",
      tone: "danger",
    });
    if (!step2) return;

    setBusy("import");
    try {
      const stats: SyncActivitiesStats = await apiSyncActivities(userId, {
        forceLastDays: 30,
        fetchDetails: true,
      });

      const imp = stats.imported ?? 0;
      const upd = stats.updated ?? 0;
      const skp = stats.skipped ?? 0;

      toast.success(
        `Import from Strava OK • imported: ${imp} • updated: ${upd} • skipped: ${skp}`,
      );

      resetClientCache();
    } catch (e: any) {
      toast.error(e?.message || "Import from Strava failed.");
    } finally {
      setBusy(null);
    }
  }

  const disabled = !userId || busy !== null;

  return (
    <section className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Strava</h2>
          <p className="mt-1 text-xs opacity-70">
            Prepojenie účtu, reload cache a manuálny import posledných 30 dní.
          </p>
        </div>
      </header>

      <div className="space-y-3 text-sm">
        <div className="space-y-1">
          <div className="text-xs font-semibold opacity-80">
            1. Prepojenie účtu
          </div>
          <p className="text-xs opacity-70">
            Otvorí Strava autorizáciu v novom okne. Po potvrdení ťa presmeruje
            späť sem.
          </p>
          <Button
            size="sm"
            variant="primary"
            disabled={!stravaConnectUrl}
            onClick={() => {
              if (!stravaConnectUrl) return;
              window.location.href = stravaConnectUrl;
            }}
          >
            Pripojiť Strava
          </Button>
        </div>

        <div className="space-y-1 pt-2 border-t border-white/10">
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
                Reloading…
              </span>
            ) : (
              "Reload data"
            )}
          </Button>
        </div>

        <div className="space-y-1 pt-2 border-t border-white/10">
          <div className="text-xs font-semibold opacity-80">
            3. Import z&nbsp;Stravy
          </div>
          <p className="text-xs opacity-70">
            Manuálny import posledných 30 dní aktivít. Ak existujú v DB, záznamy
            sa updatnú, inak sa vytvoria nové.
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