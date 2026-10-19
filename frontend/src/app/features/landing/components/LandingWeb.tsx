"use client";

import Link from "next/link";
import Image from "next/image";
import AppFooter from "@/app/shared/ui/components/AppFooter";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { alpha } from "@/app/shared/ui/theme/colorUtils";
import { STRAVA_ASSETS } from "@/app/shared/ui/components/Strava";
import LangSelector from "@/app/shared/i18n/LangSelector";
import type { TKey } from "@/app/shared/i18n/useT";
import type { LandingT } from "../hooks/useLandingT";

const WRAP = "max-w-6xl mx-auto px-4 sm:px-6";

const CARD_STYLE = {
  background: appColors.surfaceCard,
  border: `1px solid ${appColors.surfaceCardBorder}`,
  boxShadow: appColors.shadowCard,
} as const;

const GLOW = `radial-gradient(closest-side, ${alpha(appColors.brandPrimary, 0.32)}, transparent)`;

const WHY: { icon: string; title: TKey; text: TKey }[] = [
  { icon: "🧠", title: "landing.web.why.plan.title", text: "landing.web.why.plan.text" },
  { icon: "💬", title: "landing.web.why.review.title", text: "landing.web.why.review.text" },
  { icon: "🏋️", title: "landing.web.why.balance.title", text: "landing.web.why.balance.text" },
  { icon: "📱", title: "landing.web.why.phone.title", text: "landing.web.why.phone.text" },
];

const FOCUS: { img: string; title: TKey; text: TKey }[] = [
  { img: "/landing/trail.webp", title: "landing.web.focus.run.title", text: "landing.web.focus.run.text" },
  { img: "/landing/lift.webp", title: "landing.web.focus.strength.title", text: "landing.web.focus.strength.text" },
  { img: "/landing/ocr.webp", title: "landing.web.focus.ocr.title", text: "landing.web.focus.ocr.text" },
  { img: "/landing/woman.webp", title: "landing.web.focus.health.title", text: "landing.web.focus.health.text" },
];

const STEPS: TKey[] = ["landing.web.steps.s1", "landing.web.steps.s2", "landing.web.steps.s3"];

function CtaButtons({ t, center }: { t: LandingT; center?: boolean }) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${center ? "justify-center" : "justify-center md:justify-start"}`}>
      <Link
        href="/signup"
        className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-base font-semibold transition-colors"
        style={{ background: appColors.buttonPrimaryBg, color: appColors.buttonPrimaryText }}
      >
        {t("landing.ctaStart")}
      </Link>
      <Link
        href="/signin"
        className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-base font-semibold transition-colors"
        style={{
          background: appColors.buttonGhostBg,
          color: appColors.textPrimary,
          border: `1px solid ${appColors.surfaceCardBorder}`,
        }}
      >
        {t("landing.ctaSignIn")}
      </Link>
    </div>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">{children}</h2>
      {sub && (
        <p className="mt-3 text-sm sm:text-base leading-relaxed" style={{ color: appColors.textSecondary }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/*
 * Landing pre návštevníka v prehliadači (väčšinou z reklamy): čo SelfRace je,
 * prečo ho skúsiť, pre koho je a ako začať – registrácia a prihlásenie hore aj dole.
 * Maskoti sú tie isté ako na Instagrame, aby človek z reklamy spoznal značku.
 */
export default function LandingWeb({ t }: { t: LandingT }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className={`${WRAP} w-full pt-5 flex items-center justify-between gap-3`}>
        <Image
          src="/logo/actual/selfrace_logo.svg"
          alt="SelfRace"
          width={520}
          height={140}
          priority
          className="h-auto w-[128px] sm:w-[160px]"
        />
        <div className="flex items-center gap-2">
          <LangSelector variant="editable" size="sm" />
          <Link
            href="/signin"
            className="inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap"
            style={{
              background: appColors.buttonGhostBg,
              color: appColors.textPrimary,
              border: `1px solid ${appColors.surfaceCardBorder}`,
            }}
          >
            {t("landing.ctaSignIn")}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO – na mobile najprv maskoti (zaujmú), hneď pod nimi text a tlačidlá */}
        <section className={`${WRAP} pt-4 pb-12 md:pt-10 md:pb-20 grid md:grid-cols-2 gap-4 md:gap-10 items-center`}>
          <div className="relative md:order-2 flex justify-center">
            <div aria-hidden className="absolute inset-0 m-auto w-[85%] aspect-square" style={{ background: GLOW }} />
            <Image
              src="/landing/pair.webp"
              alt={t("landing.web.mascotAlt")}
              width={1051}
              height={900}
              priority
              sizes="(min-width: 768px) 520px, 260px"
              className="relative h-auto w-[230px] sm:w-[300px] md:w-full md:max-w-[520px]"
            />
          </div>

          <div className="md:order-1 text-center md:text-left">
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-4"
              style={{ background: appColors.brandPrimary, color: appColors.buttonPrimaryText }}
            >
              {t("landing.trial.badge")}
            </div>

            <h1 className="text-[2rem] leading-tight sm:text-5xl md:text-6xl font-bold tracking-tight text-balance">
              {t("landing.web.heroTitle")}
            </h1>

            <p
              className="mt-4 text-base sm:text-lg leading-relaxed max-w-xl mx-auto md:mx-0"
              style={{ color: appColors.textSecondary }}
            >
              {t("landing.web.heroText")}
            </p>

            <p className="mt-3 text-sm font-semibold text-balance" style={{ color: appColors.brandPrimary }}>
              {t("landing.web.heroSports")}
            </p>

            <div className="mt-6">
              <CtaButtons t={t} />
            </div>

            <p className="text-xs mt-3" style={{ color: appColors.textSecondary }}>
              {t("landing.trial.note")}
            </p>
            <p className="text-xs mt-1" style={{ color: appColors.textMuted }}>
              {t("landing.web.heroDevice")}
            </p>
          </div>
        </section>

        {/* PREČO */}
        <section className={`${WRAP} py-10 md:py-14`}>
          <SectionTitle>{t("landing.web.whyTitle")}</SectionTitle>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WHY.map((w) => (
              <div key={w.title} className="rounded-3xl p-5 backdrop-blur-xl" style={CARD_STYLE}>
                <div className="flex items-center gap-3 lg:flex-col lg:items-start">
                  <div
                    aria-hidden
                    className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
                    style={{ background: alpha(appColors.brandPrimary, 0.14) }}
                  >
                    {w.icon}
                  </div>
                  <h3 className="text-lg font-semibold leading-snug">{t(w.title)}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
                  {t(w.text)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* PRE KOHO */}
        <section className={`${WRAP} py-10 md:py-14`}>
          <SectionTitle sub={t("landing.web.focusText")}>{t("landing.web.focusTitle")}</SectionTitle>
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {FOCUS.map((f) => (
              <div key={f.title} className="rounded-3xl p-3 sm:p-5 backdrop-blur-xl flex flex-col" style={CARD_STYLE}>
                <div className="relative h-36 sm:h-52">
                  <div aria-hidden className="absolute inset-0 m-auto w-[80%] aspect-square max-h-full" style={{ background: GLOW }} />
                  <Image
                    src={f.img}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 240px, 45vw"
                    className="object-contain"
                  />
                </div>
                <h3 className="mt-3 text-base sm:text-lg font-semibold leading-snug">{t(f.title)}</h3>
                <p className="mt-1 text-xs sm:text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
                  {t(f.text)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* AKO ZAČAŤ */}
        <section className={`${WRAP} py-10 md:py-14`}>
          <SectionTitle>{t("landing.web.stepsTitle")}</SectionTitle>
          <ol className="mt-8 grid md:grid-cols-3 gap-4">
            {STEPS.map((key, i) => (
              <li key={key} className="rounded-3xl p-5 backdrop-blur-xl flex items-start gap-4" style={CARD_STYLE}>
                <span
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold"
                  style={{ background: appColors.brandPrimary, color: appColors.buttonPrimaryText }}
                >
                  {i + 1}
                </span>
                <span className="text-sm sm:text-base leading-relaxed pt-1">{t(key)}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* PRÍBEH – SelfRace robí jeden človek, to je dôvod mu veriť */}
        <section className={`${WRAP} py-10 md:py-14`}>
          <div
            className="rounded-3xl p-6 sm:p-8 backdrop-blur-xl flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-7 max-w-3xl mx-auto"
            style={CARD_STYLE}
          >
            <div
              className="relative w-24 h-24 rounded-full overflow-hidden shrink-0"
              style={{ border: `2px solid ${appColors.brandPrimary}` }}
            >
              <Image
                src="/other/meSpartan.jpeg"
                alt={t("landing.web.storyPhotoAlt")}
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold">{t("landing.web.storyTitle")}</h2>
              <p className="mt-2 text-sm sm:text-base leading-relaxed" style={{ color: appColors.textSecondary }}>
                {t("landing.web.storyText")}
              </p>
              <Link
                href="/ourStory"
                className="inline-block mt-3 text-sm font-semibold hover:underline"
                style={{ color: appColors.brandPrimary }}
              >
                {t("landing.web.storyLink")} →
              </Link>
            </div>
          </div>
        </section>

        {/* ZÁVER */}
        <section className={`${WRAP} pt-10 pb-14 md:pt-14 md:pb-20`}>
          <div
            className="rounded-3xl px-6 sm:px-10 pt-8 md:py-10 backdrop-blur-xl grid md:grid-cols-[1fr_auto] gap-6 items-center overflow-hidden"
            style={CARD_STYLE}
          >
            <div className="text-center md:text-left">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-balance">
                {t("landing.web.finalTitle")}
              </h2>
              <p className="mt-3 text-sm sm:text-base leading-relaxed" style={{ color: appColors.textSecondary }}>
                {t("landing.web.finalText")}
              </p>
              <div className="mt-6">
                <CtaButtons t={t} />
              </div>
              <p className="text-xs mt-3" style={{ color: appColors.textSecondary }}>
                {t("landing.trial.note")}
              </p>
            </div>
            <div className="relative flex justify-center md:-mb-10">
              <div aria-hidden className="absolute inset-0 m-auto w-[90%] aspect-square" style={{ background: GLOW }} />
              <Image
                src="/landing/man.webp"
                alt=""
                width={518}
                height={900}
                sizes="220px"
                className="relative h-auto w-[170px] md:w-[220px]"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <Image
              src={STRAVA_ASSETS.poweredBySvg_white}
              alt="Powered by Strava"
              width={220}
              height={28}
              style={{ height: 18, width: "auto", opacity: 0.9 }}
            />
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
