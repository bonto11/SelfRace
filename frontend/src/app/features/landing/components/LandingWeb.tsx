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
const ICON_BG = alpha(appColors.brandPrimary, 0.14);

const DIFF: { icon: string; title: TKey; text: TKey }[] = [
  { icon: "🔄", title: "landing.web.diff.adapt.title", text: "landing.web.diff.adapt.text" },
  { icon: "💬", title: "landing.web.diff.explain.title", text: "landing.web.diff.explain.text" },
  { icon: "⚖️", title: "landing.web.diff.together.title", text: "landing.web.diff.together.text" },
  { icon: "🤝", title: "landing.web.diff.local.title", text: "landing.web.diff.local.text" },
];

const HOW: { title: TKey; text: TKey }[] = [
  { title: "landing.web.how.s1.title", text: "landing.web.how.s1.text" },
  { title: "landing.web.how.s2.title", text: "landing.web.how.s2.text" },
  { title: "landing.web.how.s3.title", text: "landing.web.how.s3.text" },
  { title: "landing.web.how.s4.title", text: "landing.web.how.s4.text" },
];

// Každý maskot je na stránke len raz (hero má vlastných – unavený a spokojný).
const FOCUS: { img: string; title: TKey; text: TKey }[] = [
  { img: "/landing/trail.webp", title: "landing.web.focus.run.title", text: "landing.web.focus.run.text" },
  { img: "/landing/lift.webp", title: "landing.web.focus.strength.title", text: "landing.web.focus.strength.text" },
  { img: "/landing/ocr.webp", title: "landing.web.focus.ocr.title", text: "landing.web.focus.ocr.text" },
  { img: "/landing/health.webp", title: "landing.web.focus.health.title", text: "landing.web.focus.health.text" },
];

const MODES: { icon: string; title: TKey; text: TKey; badge?: TKey }[] = [
  { icon: "🧠", title: "landing.web.modes.coach.title", text: "landing.web.modes.coach.text" },
  { icon: "🧭", title: "landing.web.modes.advisor.title", text: "landing.web.modes.advisor.text" },
  {
    icon: "👤",
    title: "landing.web.modes.live.title",
    text: "landing.web.modes.live.text",
    badge: "landing.web.modes.live.badge",
  },
];

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-balance">{children}</h2>
      {sub && (
        <p className="mt-3 text-sm sm:text-base leading-relaxed" style={{ color: appColors.textSecondary }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function IconBox({ icon }: { icon: string }) {
  return (
    <div
      aria-hidden
      className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
      style={{ background: ICON_BG }}
    >
      {icon}
    </div>
  );
}

// Unavený bez SelfRace → spokojný so SelfRace: na prvý pohľad, čo appka mení.
function Compare({ t }: { t: LandingT }) {
  return (
    <div className="flex items-end justify-center gap-1 sm:gap-3">
      <figure className="flex-1 max-w-[210px] text-center">
        <div className="relative aspect-[3/5]">
          <Image
            src="/landing/tired-simple.webp"
            alt={t("landing.web.compareAltBefore")}
            fill
            priority
            sizes="(min-width: 768px) 210px, 40vw"
            className="object-contain object-bottom"
            style={{ filter: "saturate(0.55) brightness(0.85)" }}
          />
        </div>
        <figcaption className="mt-3">
          <span className="block text-sm sm:text-base font-semibold" style={{ color: appColors.textSecondary }}>
            {t("landing.web.compareBefore")}
          </span>
          <span className="block text-xs sm:text-sm" style={{ color: appColors.textMuted }}>
            {t("landing.web.compareBeforeSub")}
          </span>
        </figcaption>
      </figure>

      <svg
        aria-hidden
        viewBox="0 0 48 24"
        className="shrink-0 w-10 sm:w-14 self-center mb-12"
        fill="none"
        stroke={appColors.brandPrimary}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12h40M33 3l10 9-10 9" />
      </svg>

      <figure className="relative flex-1 max-w-[210px] text-center">
        <div className="relative aspect-[3/5]">
          <div aria-hidden className="absolute inset-0 m-auto w-full aspect-square" style={{ background: GLOW }} />
          <Image
            src="/landing/happy.webp"
            alt={t("landing.web.compareAltAfter")}
            fill
            priority
            sizes="(min-width: 768px) 210px, 40vw"
            className="object-contain object-bottom"
          />
        </div>
        <figcaption className="mt-3">
          <span className="block text-sm sm:text-base font-semibold" style={{ color: appColors.brandPrimary }}>
            {t("landing.web.compareAfter")}
          </span>
          <span className="block text-xs sm:text-sm" style={{ color: appColors.textSecondary }}>
            {t("landing.web.compareAfterSub")}
          </span>
        </figcaption>
      </figure>
    </div>
  );
}

/*
 * Landing pre návštevníka v prehliadači (väčšinou z reklamy). Poradie je zámerné:
 * najprv čo SelfRace je a čo znamená názov, potom v čom je iný, pre koho je,
 * ako sa používa a aké má režimy – registrácia až na konci, keď človek vie, do čoho ide.
 * Prihlásenie je hore v hlavičke pre tých, čo účet už majú.
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
        {/* HERO – čo je SelfRace a čo znamená názov */}
        <section className={`${WRAP} pt-6 pb-10 md:pt-12 md:pb-16 grid md:grid-cols-2 gap-8 md:gap-12 items-center`}>
          <div className="md:order-2">
            <Compare t={t} />
          </div>

          <div className="md:order-1 text-center md:text-left">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-widest" style={{ color: appColors.brandPrimary }}>
              {t("landing.web.heroEyebrow")}
            </p>
            <h1 className="mt-3 text-[2rem] leading-tight sm:text-5xl md:text-[3.25rem] font-bold tracking-tight text-balance">
              {t("landing.web.heroTitle")}
            </h1>

            <div className="mt-6 rounded-2xl px-5 py-4 text-left backdrop-blur-xl" style={CARD_STYLE}>
              <p className="text-lg sm:text-xl font-semibold">
                <span style={{ color: appColors.brandPrimary }}>Self</span> = {t("landing.web.nameSelf")}
                <span className="mx-2" style={{ color: appColors.textMuted }}>
                  ·
                </span>
                <span style={{ color: appColors.brandPrimary }}>Race</span> = {t("landing.web.nameRace")}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
                {t("landing.web.nameText")}
              </p>
            </div>

            <p
              className="mt-5 text-base sm:text-lg leading-relaxed max-w-xl mx-auto md:mx-0"
              style={{ color: appColors.textSecondary }}
            >
              {t("landing.web.heroText")}
            </p>

            <a
              href="#diff"
              className="inline-flex items-center gap-2 mt-6 text-sm font-semibold"
              style={{ color: appColors.brandPrimary }}
            >
              {t("landing.web.scrollHint")}
              <span aria-hidden className="animate-bounce">
                ↓
              </span>
            </a>
          </div>
        </section>

        {/* V ČOM JE INÝ */}
        <section id="diff" className={`${WRAP} py-10 md:py-14 scroll-mt-4`}>
          <SectionTitle>{t("landing.web.diffTitle")}</SectionTitle>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DIFF.map((d) => (
              <div key={d.title} className="rounded-3xl p-5 backdrop-blur-xl" style={CARD_STYLE}>
                <div className="flex items-center gap-3 lg:flex-col lg:items-start">
                  <IconBox icon={d.icon} />
                  <h3 className="text-lg font-semibold leading-snug">{t(d.title)}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
                  {t(d.text)}
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
                  <div
                    aria-hidden
                    className="absolute inset-0 m-auto w-[80%] aspect-square max-h-full"
                    style={{ background: GLOW }}
                  />
                  <Image src={f.img} alt="" fill sizes="(min-width: 1024px) 240px, 45vw" className="object-contain" />
                </div>
                <h3 className="mt-3 text-base sm:text-lg font-semibold leading-snug">{t(f.title)}</h3>
                <p className="mt-1 text-xs sm:text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
                  {t(f.text)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* AKO TO FUNGUJE */}
        <section className={`${WRAP} py-10 md:py-14`}>
          <SectionTitle>{t("landing.web.howTitle")}</SectionTitle>
          <ol className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {HOW.map((h, i) => (
              <li key={h.title} className="rounded-3xl p-5 backdrop-blur-xl" style={CARD_STYLE}>
                <div className="flex items-center gap-3">
                  <span
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold"
                    style={{ background: appColors.brandPrimary, color: appColors.buttonPrimaryText }}
                  >
                    {i + 1}
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold leading-snug">{t(h.title)}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
                  {t(h.text)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* REŽIMY */}
        <section className={`${WRAP} py-10 md:py-14`}>
          <SectionTitle sub={t("landing.web.modesText")}>{t("landing.web.modesTitle")}</SectionTitle>
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {MODES.map((m) => (
              <div
                key={m.title}
                className="rounded-3xl p-5 backdrop-blur-xl"
                style={{ ...CARD_STYLE, opacity: m.badge ? 0.8 : 1 }}
              >
                <div className="flex items-center gap-3">
                  <IconBox icon={m.icon} />
                  <h3 className="text-lg font-semibold leading-snug">{t(m.title)}</h3>
                  {m.badge && (
                    <span
                      className="ml-auto shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
                      style={{ background: ICON_BG, color: appColors.brandPrimary }}
                    >
                      {t(m.badge)}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
                  {t(m.text)}
                </p>
              </div>
            ))}
          </div>
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

        {/* ZÁVER – registrácia až tu */}
        <section className={`${WRAP} pt-10 pb-14 md:pt-14 md:pb-20`}>
          <div
            className="rounded-3xl px-6 sm:px-10 py-8 md:py-10 backdrop-blur-xl grid md:grid-cols-2 gap-6 md:gap-10 items-center"
            style={CARD_STYLE}
          >
            <div className="relative flex justify-center">
              <div aria-hidden className="absolute inset-0 m-auto w-[85%] aspect-square" style={{ background: GLOW }} />
              <Image
                src="/landing/pair.webp"
                alt={t("landing.web.mascotAlt")}
                width={1051}
                height={900}
                sizes="(min-width: 768px) 460px, 80vw"
                className="relative h-auto w-[260px] sm:w-[340px] md:w-full md:max-w-[460px]"
              />
            </div>

            <div className="text-center md:text-left">
              <div
                className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
                style={{ background: appColors.brandPrimary, color: appColors.buttonPrimaryText }}
              >
                {t("landing.trial.badge")}
              </div>
              <h2 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-balance">
                {t("landing.web.finalTitle")}
              </h2>
              <p className="mt-3 text-sm sm:text-base leading-relaxed" style={{ color: appColors.textSecondary }}>
                {t("landing.web.finalText")}
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
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

              <p className="text-xs mt-3" style={{ color: appColors.textSecondary }}>
                {t("landing.trial.note")}
              </p>
              <p className="text-xs mt-1" style={{ color: appColors.textMuted }}>
                {t("landing.web.heroDevice")}
              </p>
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
