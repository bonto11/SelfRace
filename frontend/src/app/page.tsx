// src/app/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import AppBackdrop from "@/app/shared/ui/components/AppBackdrop";
import { appColors } from "@/app/shared/theme/app_colors";

export default function LandingPage() {
  return (
    <AppBackdrop>
      <main className="min-h-dvh flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full text-center">
          {/* Glass hero card */}
          <div
            className="rounded-3xl px-6 sm:px-8 py-10 sm:py-12 backdrop-blur-xl"
            style={{
              background: appColors.surfaceCard,
              border: `1px solid ${appColors.surfaceCardBorder}`,
              boxShadow: appColors.shadowCard,
            }}
          >
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Image
                src="/logo/Selfrace_name.png"
                alt="SelfRace"
                width={520}
                height={140}
                priority
                className="h-auto w-[260px] sm:w-[340px] md:w-[420px]"
              />
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
              Osobný tréningový coach, ktorý pozná tvoje dáta.
            </h1>

            <p
              className="text-sm sm:text-base max-w-xl mx-auto mt-4 leading-relaxed"
              style={{ color: appColors.textSecondary }}
            >
              Prepojíš Stravu, nastavíš cieľ a aplikácia ti bude stavať
              tréningové bloky, sledovať únavu a zónu komfortu. Žiadne random
              plány z internetu.
            </p>

            {/* CTA buttons */}
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
                Začať zdarma
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
                Prihlásiť sa
              </Link>
            </div>

            <p
              className="text-[11px] mt-6"
              style={{ color: appColors.textMuted }}
            >
              Powered by Strava • detailné metriky behu, tréningové zóny a AI
              coach.
            </p>
          </div>

          {/* malý “status” bar pod kartou */}
          <div className="flex justify-center mt-4">
            <div
              className="h-1 w-40 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${appColors.brandPrimary}, ${appColors.accentTeal})`,
                opacity: 0.85,
              }}
            />
          </div>
        </div>
      </main>
    </AppBackdrop>
  );
}
