"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { parseAndFormatPrettyDate } from "@/app/shared/utils/time";

import {
  apiGetStravaStatus,
  apiGetStravaConnectUrl,
  canConnectStravaNow,
  type StravaStatus,
} from "@/app/features/strava/api/strava";
import type { SyncActivitiesStats } from "@/app/features/activities/types/synchronization";
import ProgressBar from "@/app/shared/ui/components/ProgressBar";
import {
  apiSyncActivities,
  formatSyncProgressLabel,
  type SyncProgress,
} from "@/app/features/strava/api/synchronization";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { refreshCoachPrefsFromDB } from "@/app/features/prefs/utils/prefs";
import { apiSavePushSubscription } from "@/app/features/settings/api/notifications";
import { useT } from "@/app/shared/i18n/useT";
import CardBackdrop from "@/app/shared/ui/components/CardBackdrop";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { Check, Lock, Sparkles, X } from "lucide-react";

// Banner patrí len na začiatok. Keď ho user raz dokončí alebo zavrie, už sa
// neukáže - ani keď sa neskôr niečo zmení (odpojí Stravu, zruší plán).
const doneKey = (userId: number | string) => `selfrace.onboarding.done.${userId}`;

function readOnboardingDone(userId: number | string | null | undefined): boolean {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(doneKey(userId)) === "1";
  } catch {
    return false;
  }
}

function writeOnboardingDone(userId: number | string | null | undefined): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(doneKey(userId), "1");
  } catch {
    // súkromné okno - banner sa skryje aspoň podľa stavu krokov
  }
}

type StepStatus = "done" | "active" | "locked";

type WidgetOnboardingProps = {
  coachPrefsHref?: string;
  generatePlanHref?: string;
  bioHref?: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");
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
  const t = useT();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (readOnboardingDone(userId)) setDismissed(true);
  }, [userId]);

  /* ─── Strava ─── */
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] = useState<SyncProgress | null>(
    null,
  );

  /* ─── Plán ─── */
  // 🌟 FIX: predtým "hasActivePlan" čítal has_active, čo je False aj po
  // ÚSPEŠNOM dokončení plánu (status prejde na "completed") - onboarding
  // widget sa tak nesprávne znova zobrazil starým userom, čo už celý flow
  // raz absolvovali. Teraz čítame has_any_plan (má NIEKEDY vytvorený
  // čokoľvek - active/completed/generated/canceled), čo správne rozlišuje
  // "úplne nový user" od "user, čo si plán práve dokončil/zrušil".
  // stav plánu zdieľa coach provider (rovnaký request ako coach stránka)
  const { activePlanStatus } = useCoachData();
  const hasAnyPlan = !!activePlanStatus.data?.has_any_plan;
  const planStatusLoading = !activePlanStatus.loaded;

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

  // Stav Stravy drží activity provider. Kto má onboarding hotový (alebo
  // zatvorený), tomu sa widget neukáže - nemá zmysel preň nič načítavať.
  const { stravaStatus } = useActivityData();

  useEffect(() => {
    if (!userId || readOnboardingDone(userId)) return;
    stravaStatus.ensure();
    activePlanStatus.ensure();
  }, [userId, stravaStatus.ensure, activePlanStatus.ensure]);

  useEffect(() => {
    if (stravaStatus.data !== undefined) setStatus(stravaStatus.data);
    if (stravaStatus.loaded) setStatusLoading(false);
  }, [stravaStatus.data, stravaStatus.loaded]);

  useEffect(() => {
    if (!userId || readOnboardingDone(userId)) return;
    let alive = true;
    setPrefsStatusLoading(true);
    refreshCoachPrefsFromDB(userId)
      .then((p: any) => {
        // cieľ - hlavné rozhodnutie, nie je predvyplnený (hlavný šport áno)
        if (alive) setCoachPrefsDone(!!p?.goal_kind);
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

      navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (!reg) {
            setPushCheckDone(true);
            return;
          }
          return reg.pushManager.getSubscription().then((sub) => {
            if (sub) setPushSubscribed(true);
            setPushCheckDone(true);
          });
        })
        .catch((e) => {
          console.error("[WidgetOnboarding] push registration check error:", e);
          setPushCheckDone(true);
        });
    } else {
      setPushSupported(false);
      setPushCheckDone(true);
    }
  }, []);

  const connected = !!status?.connected;
  const canConnect = canConnectStravaNow(status);
  // Dôležité: ever_synced_at sa nikdy nereseneuje (má to tak zostať - je to
  // anti-abuse ochrana proti opakovanému disconnect/reconnect kvôli Strava
  // limitom), takže samotné nestačí ako signál "dáta sú tu". Kombinujeme ho
  // s connected (nemôže byť "done", keď je Strava odpojená - v DB nemôžeme
  // nič mať) a s sync_import_kind, ktorý BE počíta priamo z reálnej
  // prítomnosti aktivít v activities_summary (last_activity_dt), takže presne
  // odzrkadľuje, či dáta reálne existujú, aj po reconnecte s vymazanými dátami.
  const importDone =
    connected &&
    (status?.sync_import_kind === "manual" ||
      status?.sync_import_kind === "quick");
  const reconnectAfterLabel = status?.reconnect_after
    ? parseAndFormatPrettyDate(status.reconnect_after)
    : null;

  async function handleImport() {
    if (!userId || importBusy || !connected) return;
    setImportBusy(true);
    setImportProgress({ progress: 0, status: "queued" });
    try {
      const days =
        typeof status?.sync_import_window_days === "number" &&
        status.sync_import_window_days > 0
          ? status.sync_import_window_days
          : 7;

      const stats: SyncActivitiesStats = await apiSyncActivities(
        userId,
        { forceLastDays: days, fetchDetails: true },
        (p) => {
          setImportProgress(p);
        },
      );

      toast.success(
        t("onboardingWidget.stravaImport.done")
          .replace("{{imported}}", String(stats.imported ?? 0))
          .replace("{{updated}}", String(stats.updated ?? 0)),
      );

      const fresh = await apiGetStravaStatus(userId);
      setStatus(fresh);
      stravaStatus.setData(() => fresh);
    } catch (e: any) {
      console.error("[WidgetOnboarding] import error:", e);
      toast.error(e?.message || t("onboardingWidget.stravaImport.failed"));
    } finally {
      setImportBusy(false);
      setImportProgress(null);
    }
  }

  async function handleEnablePush() {
    if (!userId || !pushSupported) {
      return;
    }
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(t("onboardingWidget.push.denied"));
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
      toast.success(t("onboardingWidget.push.enabled"));
    } catch (e: any) {
      console.error("[WidgetOnboarding] push error:", e);
      toast.error(t("onboardingWidget.push.failed"));
    } finally {
      setPushLoading(false);
    }
  }

  const initialLoading =
    statusLoading || planStatusLoading || prefsStatusLoading || !pushCheckDone;

  const allDone = connected && importDone && coachPrefsDone && hasAnyPlan;

  // dokončené raz = dokončené navždy
  useEffect(() => {
    if (!initialLoading && allDone) writeOnboardingDone(userId);
  }, [initialLoading, allDone, userId]);

  if (dismissed) return null;
  if (!initialLoading && allDone) return null;

  // Zavrieť sa dá až po napojení dát - bez nich appka nemá čo ukázať.
  const canDismiss = connected && importDone;

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
  const stepGeneratePlan: StepStatus = hasAnyPlan
    ? "done"
    : coachPrefsDone
      ? "active"
      : "locked";

  const supportNote = t("onboardingWidget.supportNote");

  const connectDescription = (() => {
    if (!connected && !canConnect && reconnectAfterLabel) {
      return `${t("onboardingWidget.stravaConnect.blocked").replace(
        "{{date}}",
        reconnectAfterLabel,
      )} ${supportNote}`;
    }
    return t("onboardingWidget.stravaConnect.text");
  })();

  const importDescription = status?.sync_import_window_days
    ? `${t("onboardingWidget.stravaImport.textDays").replace(
        "{{days}}",
        String(status.sync_import_window_days),
      )}${
        status?.is_admin_override
          ? ` ${t("onboardingWidget.stravaImport.adminOverride")}`
          : ""
      } ${supportNote}`
    : t("onboardingWidget.stravaImport.text");

  const steps: StepStatus[] = [
    stepStravaConnect,
    stepStravaImport,
    stepNotifications,
    stepBio,
    stepCoachPrefs,
    stepGeneratePlan,
  ];
  const doneCount = steps.filter((st) => st === "done").length;
  const progressPct = Math.round((doneCount / steps.length) * 100);

  return (
    <section className={[CARD, "relative overflow-hidden"].join(" ")} style={SURFACE_CARD_STYLE}>
      <CardBackdrop />
      <div className="relative p-4 sm:p-5">
        {/* Hlavička + priebeh */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-bold" style={{ color: appColors.textPrimary }}>
              {t("onboardingWidget.title")}
            </div>
            <div className="text-xs mt-0.5" style={{ color: appColors.textMuted }}>
              {t("onboardingWidget.subtitle")}
            </div>
          </div>
          {canDismiss ? (
            <Button
              circle
              size="sm"
              variant="ghost"
              aria-label={t("onboardingWidget.dismiss")}
              title={t("onboardingWidget.dismiss")}
              onClick={() => {
                writeOnboardingDone(userId);
                setDismissed(true);
              }}
            >
              <X size={16} />
            </Button>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div
            className="flex-1 h-1.5 rounded-full overflow-hidden"
            style={{ background: appColors.surfaceCardBorder }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: appColors.brandPrimary }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums" style={{ color: appColors.textSecondary }}>
            {doneCount}/{steps.length}
          </span>
        </div>

        <div
          className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed"
          style={{
            background: appColors.surfaceSolid,
            border: `1px solid ${appColors.brandMuted}`,
            color: appColors.textSecondary,
          }}
        >
          <Sparkles size={14} color={appColors.brandPrimary} className="shrink-0 mt-0.5" />
          <span>{t("onboardingWidget.welcomeWeek")}</span>
        </div>

        {initialLoading ? (
          <div className="flex justify-center p-4">
            <LoadingSpinner size="widget" />
          </div>
        ) : (
          <ol className="mt-3">
          <OnboardingStep
            status={stepStravaConnect}
            index={1}
            title={t("onboardingWidget.stravaConnect.title")}
            description={connectDescription}
            action={
              stepStravaConnect !== "done" ? (
                <Button
                  variant="connectStrava"
                  size="sm"
                  disabled={!userId || !canConnect}
                  onClick={async () => {
                    if (!userId) return;
                    try {
                      window.location.href = await apiGetStravaConnectUrl(userId);
                    } catch (e: any) {
                      toast.error(t(e?.message as any) || t("strava.toasts.errorGeneric"));
                    }
                  }}
                  aria-label="Connect with Strava"
                />
              ) : undefined
            }
          />

          <OnboardingStep
            status={stepStravaImport}
            index={2}
            title={t("onboardingWidget.stravaImport.title")}
            description={importDescription}
            action={
              connected ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={importBusy}
                    onClick={handleImport}
                  >
                    {importBusy ? (
                      <span className="inline-flex items-center gap-1">
                        <LoadingSpinner size="button" />
                        {t("onboardingWidget.stravaImport.busy")}
                      </span>
                    ) : (
                      t("onboardingWidget.stravaImport.button")
                    )}
                  </Button>
                  {importBusy && (
                    <ProgressBar
                      value={importProgress?.progress ?? 0}
                      label={formatSyncProgressLabel(importProgress)}
                    />
                  )}
                </div>
              ) : undefined
            }
          />

          <OnboardingStep
            status={stepNotifications}
            index={3}
            title={t("onboardingWidget.push.title")}
            description={t("onboardingWidget.push.text")}
            optional
            action={
              stepNotifications !== "done" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!pushSupported || pushLoading}
                  onClick={handleEnablePush}
                  title={
                    !pushSupported
                      ? t("onboardingWidget.push.unsupported")
                      : undefined
                  }
                >
                  {pushLoading ? (
                    <span className="inline-flex items-center gap-1">
                      <LoadingSpinner size="button" />
                      {t("onboardingWidget.push.busy")}
                    </span>
                  ) : (
                    t("onboardingWidget.push.button")
                  )}
                </Button>
              ) : undefined
            }
          />

          <OnboardingStep
            status={stepBio}
            index={4}
            title={t("onboardingWidget.bio.title")}
            description={t("onboardingWidget.bio.text")}
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
                  {t("onboardingWidget.bio.button")}
                </Button>
              ) : undefined
            }
          />

          <OnboardingStep
            status={stepCoachPrefs}
            index={5}
            title={t("onboardingWidget.goal.title")}
            description={t("onboardingWidget.goal.text")}
            action={
              stepCoachPrefs === "active" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => router.push(coachPrefsHref)}
                >
                  {t("onboardingWidget.goal.button")}
                </Button>
              ) : undefined
            }
          />

          <OnboardingStep
            status={stepGeneratePlan}
            index={6}
            last
            title={t("onboardingWidget.plan.title")}
            description={t("onboardingWidget.plan.text")}
            action={
              stepGeneratePlan === "active" ? (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => router.push(generatePlanHref)}
                >
                  {t("onboardingWidget.plan.button")}
                </Button>
              ) : undefined
            }
          />
          </ol>
        )}
      </div>
    </section>
  );
}

function OnboardingStep({
  index,
  last,
  status,
  title,
  description,
  action,
  optional,
}: {
  index: number;
  last?: boolean;
  status: StepStatus;
  title: string;
  description: string;
  action?: ReactNode;
  optional?: boolean;
}) {
  const t = useT();
  const isDone = status === "done";
  const isLocked = status === "locked";
  const isActive = status === "active";

  return (
    <li className="relative flex gap-3" style={{ opacity: isLocked ? 0.5 : 1 }}>
      {/* časová os: krúžok + spojnica */}
      <div className="flex flex-col items-center">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            background: isDone ? appColors.brandPrimary : appColors.surfaceSolid,
            border: `1.5px solid ${
              isDone || isActive ? appColors.brandPrimary : appColors.surfaceCardBorder
            }`,
            color: isDone ? appColors.buttonPrimaryText : isActive ? appColors.textPrimary : appColors.textMuted,
          }}
        >
          {isDone ? <Check size={14} strokeWidth={3} /> : isLocked ? <Lock size={12} /> : index}
        </div>
        {!last ? (
          <div
            className="w-px flex-1 my-1"
            style={{ background: isDone ? appColors.brandMuted : appColors.surfaceCardBorder }}
          />
        ) : null}
      </div>

      <div className={`min-w-0 flex-1 ${last ? "" : "pb-4"}`}>
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span
            className="text-sm font-semibold"
            style={{ color: isDone ? appColors.textMuted : appColors.textPrimary }}
          >
            {title}
          </span>
          {optional && !isDone ? (
            <span
              className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
              style={{ color: appColors.textMuted, border: `1px solid ${appColors.surfaceCardBorder}` }}
            >
              {t("onboardingWidget.optional")}
            </span>
          ) : null}
        </div>
        {/* hotové kroky len nadpis – zoznam ostane krátky */}
        {!isDone ? (
          <div className="text-xs mt-1 leading-relaxed" style={{ color: appColors.textMuted }}>
            {description}
          </div>
        ) : null}
        {action && !isDone ? <div className="mt-2.5">{action}</div> : null}
      </div>
    </li>
  );
}
