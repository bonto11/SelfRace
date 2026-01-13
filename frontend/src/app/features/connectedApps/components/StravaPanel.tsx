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

type BusyKind = "reload" | "import" | null;

export default function StravaPanel() {
  const { userId } = useUserId();
  const [busy, setBusy] = useState<BusyKind>(null);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const stravaConnectUrl = userId
    ? `${API_URL}/api/strava/oauth/start?user_id=${userId}`
    : null;

  // Po návrate z /api/strava/oauth/callback príde ?strava=ok|error
  useEffect(() => {
    const status = searchParams.get("strava");
    if (!status) return;

    if (status === "ok") {
      toast.success("Strava účet bol úspešne prepojený.");
    } else if (status === "error") {
      toast.error("Pripojenie Strava účtu zlyhalo. Skús to znova.");
    }

    // odstráň query param, nech to netoastuje pri každom reloade
    router.replace(pathname);
  }, [searchParams, pathname, router]);

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

    // 1. krok – jemné potvrdenie
    const step1 = await confirm({
      title: "Importovať aktivity zo Stravy?",
      message:
        "Spustí sa import priblížne posledných 50 dní alebo max. ~200 najnovších aktivít (vrátane detailov). Môže to chvíľu trvať.",
      okText: "Pokračovať",
      cancelText: "Zrušiť",
    });
    if (!step1) return;

    // 2. krok – „are you sure“ s danger tónom
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
        forceLastDays: 50, // ⬅️ backfill max 50 dní (BE má ešte limity na ~200 aktivít)
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

  const disabled = !userId || busy !== null;

  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-black/20 px-4 py-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Strava</h2>
          <p className="mt-1 text-xs opacity-70">
            Prepojenie účtu, reload cache a manuálny import aktivít.
          </p>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
          Powered by Strava
        </p>
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