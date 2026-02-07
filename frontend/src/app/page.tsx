"use client";

import Link from "next/link";
import Image from "next/image";
import AppBackdrop from "@/app/shared/ui/components/AppBackdrop";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { STRAVA_ASSETS } from "@/app/shared/ui/components/Strava";
import LangSelector from "@/app/shared/i18n/LangSelector";
import { useT } from "@/app/shared/i18n/useT";

export default function LandingPage() {
  const t = useT();

  return (
    <AppBackdrop>
      <main className="min-h-dvh flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full text-center">
          <div
            className="rounded-3xl px-6 sm:px-8 py-10 sm:py-12 backdrop-blur-xl"
            style={{
              background: appColors.surfaceCard,
              border: `1px solid ${appColors.surfaceCardBorder}`,
              boxShadow: appColors.shadowCard,
            }}
          >
            <div className="flex justify-center mb-6">
              <Image
                src="/logo/selfrace_logo_nocolor_230.png"
                alt="SelfRace"
                width={520}
                height={140}
                priority
                className="h-auto w-[260px] sm:w-[340px] md:w-[420px]"
              />
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
              {t("landing.h1")}
            </h1>

            <p
              className="text-sm sm:text-base max-w-xl mx-auto mt-4 leading-relaxed"
              style={{ color: appColors.textSecondary }}
            >
              {t("landing.p1")}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-semibold transition-colors"
                style={{
                  background: appColors.buttonPrimaryBg,
                  color: appColors.buttonPrimaryText,
                  border: `1px solid ${appColors.surfaceCardBorder}`,
                }}
              >
                {t("landing.ctaStart")}
              </Link>

              <Link
                href="/signin"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-semibold transition-colors"
                style={{
                  background: appColors.buttonGhostBg,
                  color: appColors.textPrimary,
                  border: `1px solid ${appColors.surfaceCardBorder}`,
                }}
              >
                {t("landing.ctaSignIn")}
              </Link>

              <LangSelector variant="editable" size="sm" />
            </div>

            <div className="mt-7 flex justify-center">
              <Image
                src={STRAVA_ASSETS.poweredBySvg_white}
                alt="Powered by Strava"
                width={220}
                height={28}
                style={{ height: 18, width: "auto", opacity: 0.9 }}
                priority={false}
              />
            </div>

            <p className="text-[11px] mt-3" style={{ color: appColors.textMuted }}>
              {t("landing.foot")}
            </p>
          </div>
        </div>
      </main>
    </AppBackdrop>
  );
}