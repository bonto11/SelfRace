"use client";

import { useState, useEffect } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { useT } from "@/app/shared/i18n/useT";
import { apiFetchUserPref, apiUpsertUserPref } from "@/app/features/prefs/api/prefs";
import { apiSavePushSubscription } from "@/app/features/settings/api/notifications";

type Props = {
  userId: number | null;
};

// 🌟 FIX: "dismissed" sa teraz sleduje aj lokálne (localStorage), nie len
// v DB per-user flagu (push_prompt_dismissed). Dôvod: DB flag je viazaný
// na USERA, nie na KONKRÉTNU INŠTALÁCIU appky. Keď si niekto appku z plochy
// zmaže a stiahne znova (hlavne iOS "Add to Home Screen"), Notification.
// permission sa resetne na "default" a live subscription zanikne, ale DB
// flag push_prompt_dismissed=true (z predošlej inštalácie) ostáva ->
// prompt sa už nikdy neukáže, hoci táto inštalácia notifikácie reálne
// nemá. localStorage sa pri zmazaní appky (na rozdiel od DB) prirodzene
// vynuluje spolu s ňou, takže presne kopíruje životný cyklus inštalácie —
// je to správne miesto na "dismissed PRE TOTO zariadenie".
const LOCAL_DISMISS_KEY = "sr.push_prompt_dismissed_local";

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

async function silentResubscribe(userId: number): Promise<boolean> {
  try {
    await navigator.serviceWorker.register("/sw.js");
    const reg = await navigator.serviceWorker.ready;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return false;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    await apiSavePushSubscription(userId, sub.toJSON());
    return true;
  } catch (e) {
    console.error("Tichá obnova push subscription zlyhala", e);
    return false;
  }
}

export default function PushNotificationPrompt({ userId }: Props) {
  const t = useT();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId || userId === 0) return;

    let alive = true;

    const checkAndShow = async () => {
      try {
        const isStandalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as any).standalone === true;

        if (!isStandalone) return;

        if (
          !("Notification" in window) ||
          !("serviceWorker" in navigator) ||
          !("PushManager" in window)
        ) {
          return;
        }

        // OS/prehliadač natvrdo zakázal -> nedá sa to programaticky obísť.
        if (Notification.permission === "denied") return;

        // 🌟 Skutočná pravda o TOMTO zariadení — má reálnu, živú subscription
        // (nie len OS povolenie)? Toto odlíši "granted, ale subscription sa
        // stratila" od skutočne funkčného stavu.
        let hasLocalSubscription = false;
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager.getSubscription();
          hasLocalSubscription = !!sub;
        } catch {
          hasLocalSubscription = false;
        }

        if (Notification.permission === "granted") {
          if (hasLocalSubscription) {
            // Táto inštalácia má reálne fungujúce notifikácie -> nič neukazuj.
            return;
          }
          // 🌟 Permission je granted, ale subscription chýba (napr. reset SW
          // registrácie) -> tichá obnova na pozadí, žiadny modal. User už
          // raz povolil, netreba sa ho znova pýtať.
          await silentResubscribe(userId);
          return;
        }

        // Sem sa dostaneme len keď permission === "default"
        // (nikdy sa nepýtalo, alebo reset po reinštalácii appky).
        const currentSettings = (await apiFetchUserPref(userId, "user.settings")) || {};
        if (!currentSettings.onboarding_seen) return;

        // 🌟 FIX: "dismissed" sa číta z localStorage (per-install), nie z DB
        // (per-user) — pozri komentár pri LOCAL_DISMISS_KEY vyššie.
        const dismissedLocally =
          typeof window !== "undefined" &&
          window.localStorage.getItem(LOCAL_DISMISS_KEY) === "1";
        if (dismissedLocally) return;

        setTimeout(() => {
          if (alive) setShowPrompt(true);
        }, 3000);
      } catch (e) {
        console.error("Nepodarilo sa skontrolovať stav notifikácií", e);
      }
    };

    checkAndShow();

    return () => {
      alive = false;
    };
  }, [userId]);

  const markAsDismissed = async () => {
    setShowPrompt(false);
    try {
      window.localStorage.setItem(LOCAL_DISMISS_KEY, "1");
    } catch {}
    if (!userId) return;
    try {
      const currentSettings = (await apiFetchUserPref(userId, "user.settings")) || {};
      const updatedSettings = {
        ...currentSettings,
        push_prompt_dismissed: true,
      };
      await apiUpsertUserPref(userId, "user.settings", updatedSettings);
    } catch (e) {
      console.error("Nepodarilo sa uložiť status push_prompt_dismissed", e);
    }
  };

  const handleAllow = async () => {
    if (!userId) return;

    setIsLoading(true);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        toast.error("Upozornenia boli zamietnuté.");
        markAsDismissed();
        return;
      }

      const ok = await silentResubscribe(userId);
      if (ok) {
        toast.success("Upozornenia boli úspešne aktivované!");
      } else {
        toast.error("Nastala chyba pri aktivácii upozornení.");
      }
    } catch (error: any) {
      console.error("Push subscription error:", error);
      toast.error("Nastala chyba pri aktivácii upozornení.");
    } finally {
      setIsLoading(false);
      markAsDismissed();
    }
  };

  const handleDismiss = () => {
    markAsDismissed();
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[99998] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-opacity">
      <div
        className="w-full max-w-sm bg-base-100 rounded-2xl shadow-2xl p-6 flex flex-col transform transition-all"
        style={{ border: `1px solid ${appColors.surfaceCardBorder}` }}
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-full mb-4" style={{ backgroundColor: `${appColors.brandPrimary}20`, color: appColors.brandPrimary }}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-white mb-2">
          {t("pushPrompt.title") as string}
        </h3>

        <p className="text-sm opacity-80 mb-6 leading-relaxed">
          {t("pushPrompt.desc") as string}
        </p>

        <div className="flex gap-3 justify-end mt-auto">
          <Button
            onClick={handleDismiss}
            variant="ghost"
            disabled={isLoading}
            className="btn-sm text-gray-400 hover:text-white"
          >
            {t("pushPrompt.later") as string}
          </Button>

          <Button
            onClick={handleAllow}
            variant="primary"
            disabled={isLoading}
            className="btn-sm flex items-center gap-2"
          >
            {isLoading && <LoadingSpinner size="button" />}
            {t("pushPrompt.allow") as string}
          </Button>
        </div>
      </div>
    </div>
  );
}
