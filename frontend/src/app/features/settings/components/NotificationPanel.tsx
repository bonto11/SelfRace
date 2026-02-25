"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";

import {
  apiSavePushSubscription,
  apiTestPushNotification,
  apiDeletePushSubscription,
} from "@/app/features/settings/api/notifications";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { INPUTS_CARD_BODY } from "@/app/shared/ui/tokens";

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

export default function NotificationPanel() {
  const { userId } = useUserId();
  const t = useT();

  const [open, setOpen] = useState(false); // Štandardne zbalené
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushTesting, setPushTesting] = useState(false);

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
        });
      });
    }
  }, []);

  async function handleEnablePush() {
    if (!userId) return;
    if (!pushSupported) {
      toast.error(t("settings.push.notSupported"));
      return;
    }
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(t("settings.push.permissionDenied"));
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
      toast.success(t("settings.push.success"));
    } catch (error: any) {
      console.error("[NotificationPanel] Push error:", error);
      toast.error(t("settings.push.error"));
    } finally {
      setPushLoading(false);
    }
  }

  async function handleDisablePush() {
    if (!userId) return;
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await apiDeletePushSubscription(userId, endpoint);
      }
      setPushSubscribed(false);
      toast.success(t("settings.push.disableSuccess" as any));
    } catch (error: any) {
      console.error("[NotificationPanel] Disable Push error:", error);
      toast.error(t("settings.push.disableError" as any));
    } finally {
      setPushLoading(false);
    }
  }

  async function handleTestPush() {
    if (!userId) return;
    setPushTesting(true);
    try {
      await apiTestPushNotification(userId);
      toast.success(t("settings.push.testSuccess" as any));
    } catch (error: any) {
      console.error("[NotificationPanel] Test Push error:", error);
      toast.error(t("settings.push.testError" as any));
    } finally {
      setPushTesting(false);
    }
  }

  const previewText = pushSupported
    ? pushSubscribed
      ? t("settings.push.btnActive" as any)
      : t("settings.push.btnEnable" as any)
    : t("settings.push.notSupportedHint" as any);

  return (
    <InputsCard
      title={t("settings.push.title")}
      subtitle={t("settings.push.desc")}
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
    >
      <div className={INPUTS_CARD_BODY}>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={pushSubscribed ? "secondary" : "primary"}
            onClick={pushSubscribed ? handleDisablePush : handleEnablePush}
            disabled={!pushSupported || pushLoading || !userId}
          >
            {pushLoading && <LoadingSpinner size="button" className="mr-2" />}
            {pushSubscribed
              ? t("settings.push.btnDisable" as any)
              : t("settings.push.btnEnable")}
          </Button>

          {pushSubscribed && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleTestPush}
              disabled={pushTesting || !userId}
              title={t("settings.push.testTitle" as any)}
            >
              {pushTesting && <LoadingSpinner size="button" className="mr-2" />}
              {t("settings.push.btnTest" as any)}
            </Button>
          )}
        </div>
        {!pushSupported && (
          <p className="text-[11px] mt-2 text-red-500">
            {t("settings.push.notSupportedHint")}
          </p>
        )}
      </div>
    </InputsCard>
  );
}
