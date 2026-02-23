// src/app/(protected)/onboarding/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/CheckBox";
import { useT } from "@/app/shared/i18n/useT";
import { apiFetchUserPref, apiUpsertUserPref } from "@/app/features/prefs/api/prefs";

export default function OnboardingPage() {
  const t = useT();
  const router = useRouter();
  
  const { userId } = useUserId();

  const [activeTab, setActiveTab] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const CHAPTERS = [
    {
      id: "welcome",
      tabLabel: t("onboarding.welcome.tab"),
      title: t("onboarding.welcome.title"),
      content: (
        <div className="space-y-3">
          <p>{t("onboarding.welcome.desc1")}</p>
          <ul className="list-disc pl-5 opacity-90 space-y-1">
            <li><b>{t("onboarding.welcome.iosTitle")}</b> <i>{t("onboarding.welcome.iosDesc")}</i></li>
            <li><b>{t("onboarding.welcome.androidTitle")}</b> <i>{t("onboarding.welcome.androidDesc")}</i></li>
          </ul>
          <p className="text-xs opacity-70 mt-4 italic">
            {t("onboarding.welcome.ps")}
          </p>
        </div>
      ),
    },
    {
      id: "strava_import",
      tabLabel: t("onboarding.data.tab"),
      title: t("onboarding.data.title"),
      content: (
        <div className="space-y-3">
          <p>{t("onboarding.data.desc1")}</p>
          <ul className="list-disc pl-5 opacity-90 space-y-1">
            <li><b>{t("onboarding.data.connectTitle")}</b> {t("onboarding.data.connectDesc")}</li>
            <li><b>{t("onboarding.data.importTitle")}</b> {t("onboarding.data.importDesc")}</li>
          </ul>
        </div>
      ),
    },
    {
      id: "profile_recovery",
      tabLabel: t("onboarding.status.tab"),
      title: t("onboarding.status.title"),
      content: (
        <div className="space-y-3">
          <p><b>{t("onboarding.status.profileTitle")}</b> {t("onboarding.status.profileDesc")}</p>
          <p><b>{t("onboarding.status.recoveryTitle")}</b> {t("onboarding.status.recoveryDesc")}</p>
        </div>
      ),
    },
    {
      id: "coach",
      tabLabel: t("onboarding.coach.tab"),
      title: t("onboarding.coach.title"),
      content: (
        <div className="space-y-3">
          <p>{t("onboarding.coach.desc1")}</p>
          <ul className="list-disc pl-5 opacity-90 space-y-1">
            <li><b>{t("onboarding.coach.prefsTitle")}</b> {t("onboarding.coach.prefsDesc")}</li>
            <li><b>{t("onboarding.coach.eventsTitle")}</b> {t("onboarding.coach.eventsDesc")}</li>
            <li><b>{t("onboarding.coach.genTitle")}</b> {t("onboarding.coach.genDesc")}</li>
          </ul>
        </div>
      ),
    }
  ];

  const handleFinish = async () => {
    if (userId && dontShowAgain) {
      try {
        const currentSettings = await apiFetchUserPref(userId, "user.settings") || {};
        
        const updatedSettings = {
          ...currentSettings,
          onboarding_seen: true,
        };

        await apiUpsertUserPref(userId, "user.settings", updatedSettings);
      } catch (e) {
        console.error("Nepodarilo sa uložiť prefs pre onboarding", e);
      }
    }
    router.push("/activities");
  };

  if (!userId) return null;

  const currentChapter = CHAPTERS[activeTab];
  const isLastTab = activeTab === CHAPTERS.length - 1;

  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-8 mt-10">
      <div 
        className="bg-base-100 rounded-3xl shadow-xl overflow-hidden flex flex-col"
        style={{ border: `1px solid ${appColors.surfaceCardBorder}` }}
      >
        <div className="flex overflow-x-auto border-b hide-scrollbar" style={{ borderColor: appColors.surfaceCardBorder }}>
          {CHAPTERS.map((chap, idx) => {
            const isActive = activeTab === idx;
            return (
              <button
                key={chap.id}
                onClick={() => setActiveTab(idx)}
                className={`flex-1 min-w-[80px] py-4 text-sm sm:text-base font-semibold transition-colors whitespace-nowrap px-4 ${
                  isActive ? "text-white" : "text-gray-500 hover:text-gray-300"
                }`}
                style={{
                  borderBottom: isActive ? `2px solid ${appColors.brandPrimary}` : "2px solid transparent"
                }}
              >
                {chap.tabLabel}
              </button>
            );
          })}
        </div>

        <div className="p-8 sm:p-12 min-h-[350px] flex flex-col justify-start relative">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-white">
            {currentChapter.title}
          </h2>
          <div className="text-base sm:text-lg leading-relaxed opacity-80 text-left">
            {currentChapter.content}
          </div>

          {/* CHECKBOX: Zobrazí sa iba na poslednej záložke */}
          {isLastTab && (
            <div className="mt-auto pt-8">
              <Checkbox
                label={t("onboarding.dontShowAgain")}
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.currentTarget.checked)}
              />
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8 bg-base-200/30 flex justify-between items-center" style={{ borderTop: `1px solid ${appColors.surfaceCardBorder}` }}>
          
          <div className="flex gap-3">
            {activeTab > 0 && (
              <button 
                onClick={() => setActiveTab(prev => prev - 1)}
                className="btn btn-ghost"
              >
                {t("onboarding.back")}
              </button>
            )}
            {!isLastTab && (
              <button 
                onClick={() => setActiveTab(prev => prev + 1)}
                className="btn btn-outline"
                style={{ borderColor: appColors.brandPrimary, color: appColors.brandPrimary }}
              >
                {t("onboarding.next")}
              </button>
            )}
          </div>

          <Button onClick={handleFinish} variant="primary" className="px-8">
            {isLastTab ? t("onboarding.finishGo") : t("onboarding.skip")}
          </Button>

        </div>
      </div>
    </div>
  );
}