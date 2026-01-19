// src/app/page.tsx
"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-white/50">
            SELF-RACE by Patrik Mbontar
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
            Osobný tréningový coach, ktorý pozná tvoje dáta.
          </h1>
          <p className="text-sm sm:text-base text-white/70 max-w-xl mx-auto">
            Prepojíš Stravu, nastavíš cieľ a aplikácia ti bude stavať tréningové
            bloky, sledovať únavu a zónu komfortu. Žiadne random plány z internetu.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-semibold bg-white text-black hover:bg-white/90 transition-colors"
          >
            Začať zdarma
          </Link>
          <Link
            href="/signin"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-semibold border border-white/30 hover:bg-white/10 transition-colors"
          >
            Prihlásiť sa
          </Link>
        </div>

        <p className="text-[11px] text-white/50 mt-2">
          Powered by Strava • detailné metriky behu, tréningové zóny a AI coach.
        </p>
      </div>
    </main>
  );
}