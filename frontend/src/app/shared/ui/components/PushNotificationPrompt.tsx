"use client";

import { useState, useEffect } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Button from "@/app/shared/ui/components/Button";
import { useT } from "@/app/shared/i18n/useT";
import { apiFetchUserPref, apiUpsertUserPref } from "@/app/features/prefs/api/prefs";

type Props = {
  userId: number | null;
};

export default function PushNotificationPrompt({ userId }: Props) {
  const t = useT();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!userId || userId === 0) return;

    let alive = true;

    const checkAndShow = async () => {
      try {
        const isStandalone = 
          window.matchMedia("(display-mode: standalone)").matches || 
          (window.navigator as any).standalone === true;
        
        if (!isStandalone) return;
        if (!("Notification" in window)) return;
        if (Notification.permission !== "default") return;

        const currentSettings = (await apiFetchUserPref(userId, "user.settings")) || {};
        
        if (!currentSettings.onboarding_seen) return;
        if (currentSettings.push_prompt_dismissed) return;

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

  const handleAllow = async () => {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Notifikácie povolené! Tu neskôr zaregistrujeme service workera a token.");
    }
    markAsDismissed();
  };

  const handleDismiss = () => {
    markAsDismissed();
  };

  const markAsDismissed = async () => {
    setShowPrompt(false);
    if (!userId) return;
    try {
      const currentSettings = (await apiFetchUserPref(userId, "user.settings")) || {};
      const updatedSettings = {
        ...currentSettings,
        push_prompt_dismissed: true,
      };
      await apiUpsertUserPref(userId, "user.settings", updatedSettings);
    } catch (e) {
      console.error("Nepodarilo sa uložiť status", e);
    }
  };

  if (!showPrompt) return null;

  return (
    // ZMENA: bg-black/85 a silnejší blur pre menšiu priehľadnosť
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
            className="btn-sm text-gray-400 hover:text-white"
          >
            {t("pushPrompt.later") as string}
          </Button>
          <Button
            onClick={handleAllow}
            variant="primary"
            className="btn-sm"
          >
            {t("pushPrompt.allow") as string}
          </Button>
        </div>
      </div>
    </div>
  );
}
