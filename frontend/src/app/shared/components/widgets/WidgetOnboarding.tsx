// src/app/shared/components/widgets/WidgetOnboarding.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  apiGetStravaStatus,
  getStravaConnectUrl,
  canConnectStravaNow,
  type StravaStatus,
} from "@/app/features/strava/api/strava";
import { apiSyncActivities } from "@/app/features/strava/api/synchronization";
import type { SyncActivitiesStats } from "@/app/features/activities/types/synchronization";

import { apiActivePlanStatus } from "@/app/features/coach/api/coach_plan_active";
import { refreshCoachPrefsFromDB } from "@/app/features/prefs/utils/prefs";
import { apiSavePushSubscription } from "@/app/features/settings/api/notifications";

const DEBUG = true;
function dbg(...args: any[]) {
  if (DEBUG) console.log("[WidgetOnboarding]", ...args);
}

type StepStatus = "done" | "active" | "locked";

type WidgetOnboardingProps = {
  coachPrefsHref?: string;
  generatePlanHref?: string;
  bioHref?: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function WidgetOnboarding({
  coachPrefsHref = "/coach/prefs",
  generatePlanHref = "/coach/prefs",
  bioHref = "/bio",
}: WidgetOnboardingProps) {
  const { userId } = useUserId();
  const router = useRouter();

  /* ─── Strava ─── */
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [importBusy, setImportBusy] = useState(false);

  /* ─── Aktívny plán ─── */
  const [hasActivePlan, setHasActivePlan] = useState(false);
  const [planStatusLoading, setPlanStatusLoading] = useState(true);

  /* ─── Coach prefs ─── */
  const [coachPrefsDone, setCoachPrefsDone] = useState(false);
  const [prefsStatusLoading, setPrefsStatusLoading] = useState(true);

  /* ─── Notifikácie ─── */
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushCheckDone, setPushCheckDone] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  /* ─── Bio ─── */
  const [bioVisited, setBioVisited] = useState(false);

  useEffect(() => {
    dbg("userId =", userId);
    if (!userId) {
      dbg("userId chýba, čakám - statusLoading/planStatusLoading/prefsStatusLoading zostávajú true");
      return;
    }
    let alive = true;
    setStatusLoading(true);
    dbg("fetch: apiGetStravaStatus START");
    apiGetStravaStatus(userId)
      .then((s) => {
        dbg("fetch: apiGetStravaStatus OK", s);
        if (alive) setStatus(s);
      })
      .catch((e) => {
        console.error("[WidgetOnboarding] strava status error:", e);
        dbg("fetch: apiGetStravaStatus FAILED", e);
      })
      .finally(() => {
        dbg("fetch: apiGetStravaStatus DONE, statusLoading -> false");
        if (alive) setStatusLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setPlanStatusLoading(true);
    dbg("fetch: apiActivePlanStatus START");
    apiActivePlanStatus(userId)
      .then((s) => {
        dbg("fetch: apiActivePlanStatus OK", s);
        if (alive) setHasActivePlan(!!s?.has_active);
      })
      .catch((e) => {
        console.error("[WidgetOnboarding] plan status error:", e);
        dbg("fetch: apiActivePlanStatus FAILED", e);
        if (alive) setHasActivePlan(false);
      })
      .finally(() => {
        dbg("fetch: apiActivePlanStatus DONE, planStatusLoading -> false");
        if (alive) setPlanStatusLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setPrefsStatusLoading(true);
    dbg("fetch: refreshCoachPrefsFromDB START");
    refreshCoachPrefsFromDB(userId)
      .then((p: any) => {
        dbg("fetch: refreshCoachPrefsFromDB OK, main_sport =", p?.main_sport);
        if (alive) setCoachPrefsDone(!!p?.main_sport);
      })
      .catch((e) => {
        console.error("[WidgetOnboarding] coach prefs status error:", e);
        dbg("fetch: refreshCoachPrefsFromDB FAILED", e);
        if (alive) setCoachPrefsDone(false);
      })
      .finally(() => {
        dbg("fetch: refreshCoachPrefsFromDB DONE, prefsStatusLoading -> false");
        if (alive) setPrefsStatusLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    dbg("push check START", {
      hasWindow: typeof window !== "undefined",
      hasServiceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
      hasPushManager: typeof window !== "undefined" && "PushManager" in window,
      isSecureContext: typeof window !== "undefined" ? window.isSecureContext : null,
      standaloneDisplay:
        typeof window !== "undefined" && window.matchMedia
          ? window.matchMedia("(display-mode: standalone)").matches
          : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });

    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    ) {
      setPushSupported(true);
      dbg("push check: PushManager je podporovaný, kontrolujem existujúcu subscription");
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          dbg("push check: existujúca subscription =", !!sub);
          if (sub) setPushSubscribed(true);
          setPushCheckDone(true);
        });
      });
    } else {
      dbg("push check: PushManager NIE JE podporovaný v tomto prostredí (viď dôvody vyššie)");
      setPushSupported(false);
      setPushCheckDone(true);
    }
  }, []);

  const connected = !!status?.connected;
  const stravaConnectUrl = userId ? getStravaConnectUrl(userId) : null;
  const canConnect = canConnectStravaNow(status);
  const importDone = !!status?.ever_synced_at;

  async function handleImport() {
    if (!userId || importBusy || !connected) return;
    setImportBusy(true);
    dbg("import START");
    try {
      const days =
        typeof status?.sync_import_window_days === "number" &&
        status.sync_import_window_days > 0
          ? status.sync_import_window_days
          : 7;

      const stats: SyncActivitiesStats = await apiSyncActivities(userId, {
        forceLastDays: days,
        fetchDetails: true,
      });
      dbg("import OK", stats);

      toast.success(
        `Import hotový • Nové: ${stats.imported ?? 0} • Aktualizované: ${stats.updated ?? 0}`,
      );

      const fresh = await apiGetStravaStatus(userId);
      dbg("import: refetched status", fresh);
      setStatus(fresh);
    } catch (e: any) {
      console.error("[WidgetOnboarding] import error:", e);
      dbg("import FAILED", e);
      toast.error(e?.message || "Import zo Strava zlyhal.");
    } finally {
      dbg("import DONE");
      setImportBusy(false);
    }
  }

  async function handleEnablePush() {
    if (!userId || !pushSupported) {
      dbg("handleEnablePush: skip, pushSupported =", pushSupported);
      return;
    }
    setPushLoading(true);
    dbg("push enable START");
    try {
      const permission = await Notification.requestPermission();
      dbg("push enable: permission =", permission);
      if (permission !== "granted") {
        toast.error("Notifikácie boli zamietnuté.");
        setPushLoading(false);
        return;
      }
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      dbg("push enable: vapidKey present =", !!vapidKey);
      if (!vapidKey) throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      dbg("push enable: subscription created", subscription.toJSON());

      await apiSavePushSubscription(userId, subscription.toJSON());
      dbg("push enable: subscription saved to backend");
      setPushSubscribed(true);
      toast.success("Notifikácie zapnuté.");
    } catch (e: any) {
      console.error("[WidgetOnboarding] push error:", e);
      dbg("push enable FAILED", e);
      toast.error("Nepodarilo sa zapnúť notifikácie.");
    } finally {
      dbg("push enable DONE");
      setPushLoading(false);
    }
  }

  const initialLoading =
    statusLoading || planStatusLoading || prefsStatusLoading || !pushCheckDone;

  useEffect(() => {
    dbg("STATE SNAPSHOT", {
      userId,
      statusLoading,
      planStatusLoading,
      prefsStatusLoading,
      pushCheckDone,
      initialLoading,
      connected,
      importDone,
      hasActivePlan,
      coachPrefsDone,
      pushSupported,
      pushSubscribed,
    });
  }, [
    userId,
    statusLoading,
    planStatusLoading,
    prefsStatusLoading,
    pushCheckDone,
    connected,
    importDone,
    hasActivePlan,
    coachPrefsDone,
    pushSupported,
    pushSubscribed,
  ]);

  const allDone = connected && importDone && hasActivePlan;

  if (!initialLoading && allDone) return null;

  const stepStravaConnect: StepStatus = connected ? "done" : "active";
  const stepStravaImport: StepStatus = importDone
    ? "done"
    : connected
      ? "active"
      : "locked";

  const stepNotifications: StepStatus = pushSubscribed ? "done" : "active";
  const stepBio: StepStatus = bioVisited ? "done" : "active";

  const stepCoachPrefs: StepStatus = coachPrefsDone
    ? "done"
    : importDone
      ? "active"
      : "locked";
  const stepGeneratePlan: StepStatus = hasActivePlan
    ? "done"
    : coachPrefsDone
      ? "active"
      : "locked";

  return (
    <section
      style={{
        borderRadius: 16,
        border: `1px solid ${appColors.surfaceCardBorder}`,
        background: appColors.surfaceCard,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: appColors.textPrimary }}>
          Rozbehni sa so SelfRace
        </div>
        <div style={{ fontSize: 12, color: appColors.textMuted, marginTop: 2 }}>
          Dokonči tieto kroky, nech ti AI kouč vie pripraviť plán na mieru.
        </div>
      </div>

      {initialLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          <OnboardingStep
            status={stepStravaConnect}
            title="Pripoj Strava účet"
            description="Tvoje aktivity sa budú automaticky synchronizovať."
            action={
              stepStravaConnect !== "done" ? (
                <Button
                  variant="connectStrava"
                  size="sm"
                  disabled={!stravaConnectUrl || !canConnect}
                  onClick={() => {
                    if (stravaConnectUrl) window.location.href = stravaConnectUrl;
                  }}
                  aria-label="Connect with Strava"
                />
              ) : undefined
            }
          />

          <OnboardingStep
            status={stepStravaImport}
            title="Importuj aktivity zo Strava"
            description="Stiahneme tvoje posledné tréningy, aby mal kouč o tebe prehľad."
            action={
              stepStravaImport === "active" ? (
                <Button size="sm" variant="secondary" disabled={importBusy} onClick={handleImport}>
                  {importBusy ? (
                    <span className="inline-flex items-center gap-1">
                      <LoadingSpinner size="button" />
                      Importujem...
                    </span>
                  ) : (
                    "Importovať aktivity"
                  )}
                </Button>
              ) : undefined
            }
          />

          <OnboardingStep
            status={stepNotifications}
            title="Zapni notifikácie"
            description="Voliteľné — pripomenieme ti tréning aj recovery zápis."
            optional
            action={
              stepNotifications !== "done" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!pushSupported || pushLoading}
                  onClick={handleEnablePush}
                  title={!pushSupported ? "Push notifikácie nie sú v tomto prehliadači/kontexte podporované" : undefined}
                >
                  {pushLoading ? (
                    <span className="inline-flex items-center gap-1">
                      <LoadingSpinner size="button" />
                      Zapínam...
                    </span>
                  ) : (
                    "Zapnúť"
                  )}
                </Button>
              ) : undefined
            }
          />

          <OnboardingStep
            status={stepBio}
            title="Vyplň bio"
            description="Voliteľné — telesné údaje pomôžu koučovi presnejšie plánovať."
            optional
            action={
              stepBio !== "done" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setBioVisited(true);
                    router.push(bioHref);
                  }}
                >
                  Otvoriť bio
                </Button>
              ) : undefined
            }
          />

          <OnboardingStep
            status={stepCoachPrefs}
            title="Nastav preferencie kouča"
            description="Povedz nám o svojich cieľoch, dostupnom čase a skúsenostiach."
            action={
              stepCoachPrefs === "active" ? (
                <Button size="sm" variant="secondary" onClick={() => router.push(coachPrefsHref)}>
                  Nastaviť
                </Button>
              ) : undefined
            }
          />

          <OnboardingStep
            status={stepGeneratePlan}
            title="Vygeneruj a spusti plán"
            description="AI kouč ti pripraví tréningový plán na mieru."
            action={
              stepGeneratePlan === "active" ? (
                <Button size="sm" variant="primary" onClick={() => router.push(generatePlanHref)}>
                  Generovať plán
                </Button>
              ) : undefined
            }
          />
        </>
      )}
    </section>
  );
}

function OnboardingStep({
  status,
  title,
  description,
  action,
  optional,
}: {
  status: StepStatus;
  title: string;
  description: string;
  action?: ReactNode;
  optional?: boolean;
}) {
  const isDone = status === "done";
  const isLocked = status === "locked";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 0",
        opacity: isLocked ? 0.45 : 1,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          marginTop: 2,
          background: isDone ? "rgba(16, 185, 129, 0.18)" : "transparent",
          border: `1.5px solid ${isDone ? "rgba(16, 185, 129, 0.7)" : appColors.surfaceCardBorder}`,
          color: isDone ? "rgba(167, 243, 208, 0.95)" : appColors.textMuted,
        }}
      >
        {isDone ? "✓" : ""}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: isDone ? appColors.textMuted : appColors.textPrimary,
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {title}
          {optional && !isDone && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                color: appColors.textMuted,
                border: `1px solid ${appColors.surfaceCardBorder}`,
                borderRadius: 6,
                padding: "1px 5px",
              }}
            >
              voliteľné
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: appColors.textMuted, marginTop: 2 }}>
          {description}
        </div>
        {action && <div style={{ marginTop: 8 }}>{action}</div>}
      </div>
    </div>
  );
}