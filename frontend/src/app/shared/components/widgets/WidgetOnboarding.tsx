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

  /* ─── Coach prefs (heuristika na main_sport - žiadny dedikovaný flag v API) ─── */
  const [coachPrefsDone, setCoachPrefsDone] = useState(false);
  const [prefsStatusLoading, setPrefsStatusLoading] = useState(true);

  /* ─── Notifikácie (reálny stav zo service workera, rovnaký flow ako NotificationPanel) ─── */
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushCheckDone, setPushCheckDone] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  /* ─── Bio (žiadne API na "hotovo" - len klik-based lokálny marker, nie zdroj pravdy) ─── */
  const [bioVisited, setBioVisited] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setStatusLoading(true);
    apiGetStravaStatus(userId)
      .then((s) => {
        if (alive) setStatus(s);
      })
      .catch((e) => console.error("[WidgetOnboarding] strava status error:", e))
      .finally(() => {
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
    apiActivePlanStatus(userId)
      .then((s) => {
        if (alive) setHasActivePlan(!!s?.has_active);
      })
      .catch((e) => {
        console.error("[WidgetOnboarding] plan status error:", e);
        if (alive) setHasActivePlan(false);
      })
      .finally(() => {
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
    refreshCoachPrefsFromDB(userId)
      .then((p: any) => {
        if (alive) setCoachPrefsDone(!!p?.main_sport);
      })
      .catch((e) => {
        console.error("[WidgetOnboarding] coach prefs status error:", e);
        if (alive) setCoachPrefsDone(false);
      })
      .finally(() => {
        if (alive) setPrefsStatusLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    ) {
      setPushSupported(true);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setPushSubscribed(true);
          setPushCheckDone(true);
        });
      });
    } else {
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

      toast.success(
        `Import hotový • Nové: ${stats.imported ?? 0} • Aktualizované: ${stats.updated ?? 0}`,
      );

      const fresh = await apiGetStravaStatus(userId);
      setStatus(fresh);
    } catch (e: any) {
      toast.error(e?.message || "Import zo Strava zlyhal.");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleEnablePush() {
    if (!userId || !pushSupported) return;
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifikácie boli zamietnuté.");
        setPushLoading(false);
        return;
      }
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await apiSavePushSubscription(userId, subscription.toJSON());
      setPushSubscribed(true);
      toast.success("Notifikácie zapnuté.");
    } catch (e: any) {
      console.error("[WidgetOnboarding] push error:", e);
      toast.error("Nepodarilo sa zapnúť notifikácie.");
    } finally {
      setPushLoading(false);
    }
  }

  const initialLoading =
    statusLoading || planStatusLoading || prefsStatusLoading || !pushCheckDone;

  // Notifikácie a Bio sú nepovinné - do "allDone" (kedy widget zmizne úplne)
  // sa nepočítajú, presne ako bolo zadané.
  const allDone = connected && importDone && hasActivePlan;

  if (!initialLoading && allDone) return null;

  const stepStravaConnect: StepStatus = connected ? "done" : "active";
  const stepStravaImport: StepStatus = importDone
    ? "done"
    : connected
      ? "active"
      : "locked";

  // Nepovinné kroky - vždy dostupné, nič neblokujú a nič ich neblokuje.
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