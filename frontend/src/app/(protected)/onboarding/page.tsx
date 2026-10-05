"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Check,
  HeartPulse,
  Link2,
  Smartphone,
  Target,
} from "lucide-react";

import PageShell from "@/app/shared/ui/components/PageShell";
import CardBackdrop from "@/app/shared/ui/components/CardBackdrop";
import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";

type Chapter = {
  id: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  tab: string;
  title: string;
  intro?: string;
  items: { title: string; desc: string }[];
  note?: string;
  cta?: { label: string; href: string };
};

export default function OnboardingPage() {
  const t = useT();
  const router = useRouter();
  const { userId } = useUserId();

  const [active, setActive] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const CHAPTERS: Chapter[] = [
    {
      id: "welcome",
      icon: Smartphone,
      tab: t("onboarding.welcome.tab"),
      title: t("onboarding.welcome.title"),
      intro: t("onboarding.welcome.desc1"),
      items: [
        { title: t("onboarding.welcome.iosTitle"), desc: t("onboarding.welcome.iosDesc") },
        { title: t("onboarding.welcome.androidTitle"), desc: t("onboarding.welcome.androidDesc") },
      ],
      note: t("onboarding.welcome.ps"),
    },
    {
      id: "notifications",
      icon: Bell,
      tab: t("onboarding.notifications.tab"),
      title: t("onboarding.notifications.title"),
      intro: t("onboarding.notifications.desc1"),
      items: [
        { title: t("onboarding.notifications.iosTitle"), desc: t("onboarding.notifications.iosDesc") },
        { title: t("onboarding.notifications.androidTitle"), desc: t("onboarding.notifications.androidDesc") },
      ],
      note: t("onboarding.notifications.ps"),
      cta: { label: t("onboarding.cta.notifications"), href: "/settings" },
    },
    {
      id: "data",
      icon: Link2,
      tab: t("onboarding.data.tab"),
      title: t("onboarding.data.title"),
      intro: t("onboarding.data.desc1"),
      items: [
        { title: t("onboarding.data.connectTitle"), desc: t("onboarding.data.connectDesc") },
        { title: t("onboarding.data.importTitle"), desc: t("onboarding.data.importDesc") },
        { title: t("onboarding.data.watchTitle"), desc: t("onboarding.data.watchDesc") },
      ],
      cta: { label: t("onboarding.cta.data"), href: "/connectedApps" },
    },
    {
      id: "status",
      icon: HeartPulse,
      tab: t("onboarding.status.tab"),
      title: t("onboarding.status.title"),
      items: [
        { title: t("onboarding.status.profileTitle"), desc: t("onboarding.status.profileDesc") },
        { title: t("onboarding.status.recoveryTitle"), desc: t("onboarding.status.recoveryDesc") },
      ],
      cta: { label: t("onboarding.cta.status"), href: "/bio" },
    },
    {
      id: "coach",
      icon: Target,
      tab: t("onboarding.coach.tab"),
      title: t("onboarding.coach.title"),
      intro: t("onboarding.coach.desc1"),
      items: [
        { title: t("onboarding.coach.prefsTitle"), desc: t("onboarding.coach.prefsDesc") },
        { title: t("onboarding.coach.eventsTitle"), desc: t("onboarding.coach.eventsDesc") },
        { title: t("onboarding.coach.genTitle"), desc: t("onboarding.coach.genDesc") },
      ],
      cta: { label: t("onboarding.cta.coach"), href: "/coach/prefs" },
    },
  ];

  const handleFinish = async () => {
    if (userId && dontShowAgain) {
      try {
        const current = (await apiFetchUserPref(userId, "user.settings")) || {};
        await apiUpsertUserPref(userId, "user.settings", {
          ...current,
          onboarding_seen: true,
        });
      } catch (e) {
        console.error("Nepodarilo sa uložiť prefs pre onboarding", e);
      }
    }
    router.push("/activities");
  };

  if (!userId) return null;

  const chapter = CHAPTERS[active];
  const isLast = active === CHAPTERS.length - 1;
  const Icon = chapter.icon;

  return (
    <PageShell title={t("onboarding.pageTitle")} showBack={false} showPoweredByStrava={false}>
      <div className="max-w-2xl mx-auto mt-4 pb-12 space-y-4">
        {/* Stepper – klikateľné kapitoly */}
        <div>
          <div className="flex gap-1.5" role="tablist">
            {CHAPTERS.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={idx === active}
                aria-label={c.tab}
                title={c.tab}
                onClick={() => setActive(idx)}
                className="flex-1 h-1.5 rounded-full transition-colors cursor-pointer"
                style={{
                  background:
                    idx === active
                      ? appColors.brandPrimary
                      : idx < active
                        ? appColors.brandMuted
                        : appColors.surfaceCardBorder,
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs" style={{ color: appColors.textMuted }}>
            <span>
              {t("onboarding.stepOf")
                .replace("{{n}}", String(active + 1))
                .replace("{{total}}", String(CHAPTERS.length))}
            </span>
            <span style={{ color: appColors.textSecondary }}>{chapter.tab}</span>
          </div>
        </div>

        {/* Kapitola */}
        <section className={[CARD, "relative overflow-hidden"].join(" ")} style={SURFACE_CARD_STYLE}>
          <CardBackdrop />
          <div className="relative p-5 sm:p-7 space-y-5">
            <div className="flex items-start gap-4">
              <div
                className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: appColors.surfaceSolid,
                  border: `1px solid ${appColors.brandPrimary}`,
                }}
              >
                <Icon size={22} color={appColors.brandPrimary} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold leading-tight" style={{ color: appColors.textPrimary }}>
                  {chapter.title}
                </h2>
                {chapter.intro ? (
                  <p className="text-sm mt-1.5 leading-relaxed" style={{ color: appColors.textMuted }}>
                    {chapter.intro}
                  </p>
                ) : null}
              </div>
            </div>

            <ul className="space-y-2.5">
              {chapter.items.map((it) => (
                <li
                  key={it.title}
                  className="flex gap-3 rounded-2xl p-3"
                  style={{
                    background: appColors.surfaceCard,
                    border: `1px solid ${appColors.surfaceCardBorder}`,
                  }}
                >
                  <Check size={16} color={appColors.brandPrimary} strokeWidth={3} className="shrink-0 mt-0.5" />
                  <div className="min-w-0 text-sm leading-relaxed">
                    <div className="font-semibold" style={{ color: appColors.textPrimary }}>
                      {it.title}
                    </div>
                    <div style={{ color: appColors.textMuted }}>{it.desc}</div>
                  </div>
                </li>
              ))}
            </ul>

            {chapter.cta || chapter.note ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                {chapter.note ? (
                  <p className="text-xs italic" style={{ color: appColors.textMuted }}>
                    {chapter.note}
                  </p>
                ) : (
                  <span />
                )}
                {chapter.cta ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    rightIcon={<ArrowRight size={14} />}
                    onClick={() => router.push(chapter.cta!.href)}
                  >
                    {chapter.cta.label}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {isLast ? (
          <Checkbox
            label={<span className="text-sm">{t("onboarding.dontShowAgain")}</span>}
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.currentTarget.checked)}
          />
        ) : null}

        {/* Navigácia */}
        <div className="flex items-center justify-between gap-3">
          {active > 0 ? (
            <Button variant="ghost" size="md" onClick={() => setActive((a) => a - 1)}>
              {t("onboarding.back")}
            </Button>
          ) : (
            <Button variant="ghost" size="md" onClick={handleFinish}>
              {t("onboarding.skip")}
            </Button>
          )}
          {isLast ? (
            <Button variant="primary" size="md" onClick={handleFinish}>
              {t("onboarding.finishGo")}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              rightIcon={<ArrowRight size={16} />}
              onClick={() => setActive((a) => a + 1)}
            >
              {t("onboarding.next")}
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  );
}
