"use client";

import { useState, useEffect } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import { useT } from "@/app/shared/i18n/useT";
import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";

type Props = {
  userId: number | null;
  forceShow?: boolean;
  onCloseManual?: () => void;
};

export default function OnboardingWizard({
  userId,
  forceShow = false,
  onCloseManual,
}: Props) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
            <li>
              <b>{t("onboarding.welcome.iosTitle")}</b>{" "}
              <i>{t("onboarding.welcome.iosDesc")}</i>
            </li>
            <li>
              <b>{t("onboarding.welcome.androidTitle")}</b>{" "}
              <i>{t("onboarding.welcome.androidDesc")}</i>
            </li>
          </ul>
          <p className="text-xs opacity-70 mt-4 italic">
            {t("onboarding.welcome.ps")}
          </p>
        </div>
      ),
    },
    {
      id: "notifications",
      tabLabel: t("onboarding.notifications.tab" as any),
      title: t("onboarding.notifications.title" as any),
      content: (
        <div className="space-y-3">
          <p>{t("onboarding.notifications.desc1" as any)}</p>
          <ul className="list-disc pl-5 opacity-90 space-y-1">
            <li>
              <b>{t("onboarding.notifications.iosTitle" as any)}</b>{" "}
              {t("onboarding.notifications.iosDesc" as any)}
            </li>
            <li>
              <b>{t("onboarding.notifications.androidTitle" as any)}</b>{" "}
              {t("onboarding.notifications.androidDesc" as any)}
            </li>
          </ul>
          <p className="text-xs opacity-70 mt-4 italic">
            {t("onboarding.notifications.ps" as any)}
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
            <li>
              <b>{t("onboarding.data.connectTitle")}</b>{" "}
              {t("onboarding.data.connectDesc")}
            </li>
            <li>
              <b>{t("onboarding.data.importTitle")}</b>{" "}
              {t("onboarding.data.importDesc")}
            </li>
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
          <p>
            <b>{t("onboarding.status.profileTitle")}</b>{" "}
            {t("onboarding.status.profileDesc")}
          </p>
          <p>
            <b>{t("onboarding.status.recoveryTitle")}</b>{" "}
            {t("onboarding.status.recoveryDesc")}
          </p>
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
            <li>
              <b>{t("onboarding.coach.prefsTitle")}</b>{" "}
              {t("onboarding.coach.prefsDesc")}
            </li>
            <li>
              <b>{t("onboarding.coach.eventsTitle")}</b>{" "}
              {t("onboarding.coach.eventsDesc")}
            </li>
            <li>
              <b>{t("onboarding.coach.genTitle")}</b>{" "}
              {t("onboarding.coach.genDesc")}
            </li>
          </ul>
        </div>
      ),
    },
  ];

  useEffect(() => {
    if (!userId || userId === 0) {
      setIsLoading(false);
      return;
    }

    if (forceShow) {
      setIsOpen(true);
      setIsLoading(false);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const currentSettings =
          (await apiFetchUserPref(userId, "user.settings")) || {};

        if (!currentSettings.onboarding_seen && alive) {
          setIsOpen(true);
        }
      } catch (e) {
        console.error("Nepodarilo sa načítať prefs pre onboarding", e);
        if (alive) setIsOpen(true);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, forceShow]);

  const handleDismiss = async () => {
    setIsOpen(false);
    if (onCloseManual) onCloseManual();

    // Zápis do DB sa vykoná VÝHRADNE vtedy, ak je zaškrtnuté "Už nezobrazovať"
    if (!forceShow && userId && userId !== 0 && dontShowAgain) {
      try {
        const currentSettings =
          (await apiFetchUserPref(userId, "user.settings")) || {};

        const updatedSettings = {
          ...currentSettings,
          onboarding_seen: true,
        };

        await apiUpsertUserPref(userId, "user.settings", updatedSettings);
      } catch (e) {
        console.error("Zápis onboarding status zlyhal", e);
      }
    }
  };

  if (isLoading || !isOpen || !userId || userId === 0) return null;

  const currentChapter = CHAPTERS[activeTab];
  const isLastTab = activeTab === CHAPTERS.length - 1;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-opacity">
      <div
        className="w-full max-w-md bg-base-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col transform transition-all"
        style={{ border: `1px solid ${appColors.surfaceCardBorder}` }}
      >
        {/* Taby */}
        <div
          className="flex overflow-x-auto border-b hide-scrollbar"
          style={{ borderColor: appColors.surfaceCardBorder }}
        >
          {CHAPTERS.map((chap, idx) => {
            const isActive = activeTab === idx;
            return (
              <button
                key={chap.id}
                onClick={() => setActiveTab(idx)}
                className={`flex-1 min-w-[60px] py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap px-2 ${
                  isActive ? "text-white" : "text-gray-500 hover:text-gray-300"
                }`}
                style={{
                  borderBottom: isActive
                    ? `2px solid ${appColors.brandPrimary}`
                    : "2px solid transparent",
                }}
              >
                {chap.tabLabel}
              </button>
            );
          })}
        </div>

        {/* Hlavný obsah */}
        <div className="p-6 sm:p-8 min-h-[260px] flex flex-col justify-start relative">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">
            {currentChapter.title}
          </h2>
          <div className="text-sm sm:text-base leading-relaxed opacity-80 text-left">
            {currentChapter.content}
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-4 sm:p-6 bg-base-200/30 flex justify-between items-center"
          style={{ borderTop: `1px solid ${appColors.surfaceCardBorder}` }}
        >
          {/* ĽAVÁ STRANA: Malé preskočiť ALEBO Checkbox (na poslednom slide) */}
          <div className="flex-shrink-0">
            {!isLastTab ? (
              <button
                onClick={handleDismiss}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-4 px-1"
              >
                {t("onboarding.skip")}
              </button>
            ) : (
              <div className="hidden sm:block mt-1">
                <Checkbox
                  label={
                    <span className="text-xs font-medium text-gray-400">
                      {t("onboarding.dontShowAgain")}
                    </span>
                  }
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.currentTarget.checked)}
                />
              </div>
            )}
          </div>

          {/* PRAVÁ STRANA: Hlavná navigácia */}
          <div className="flex items-center gap-2">
            {activeTab > 0 && (
              <Button
                onClick={() => setActiveTab((prev) => prev - 1)}
                variant="ghost"
                className="btn-sm"
              >
                {t("onboarding.back")}
              </Button>
            )}

            {!isLastTab ? (
              <Button
                onClick={() => setActiveTab((prev) => prev + 1)}
                variant="primary"
                className="btn-sm sm:btn-md"
              >
                {t("onboarding.next")}
              </Button>
            ) : (
              <Button
                onClick={handleDismiss}
                variant="primary"
                className="btn-sm sm:btn-md"
              >
                {t("onboarding.finish")}
              </Button>
            )}
          </div>
        </div>

        {/* Mobilný Checkbox len na poslednom slide */}
        {isLastTab && (
          <div className="sm:hidden px-6 pb-6 bg-base-200/30">
            <Checkbox
              label={
                <span className="text-xs font-medium text-gray-400">
                  {t("onboarding.dontShowAgain")}
                </span>
              }
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.currentTarget.checked)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
