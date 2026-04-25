// src/app/(protected)/coach/plan/compliance/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";
import { PANEL_STACK } from "@/app/shared/ui/tokens";

export default function PlanCompliancePage() {
  const t = useT();

  return (
    <PageShell
      title={t("coachCompliance.stats.title")}
      showBack
      showPoweredByStrava={false}
    >
      <div className={PAGE_GRID_2}>
        
        {/* STATISTIKY */}
        <div className={PANEL_STACK}>
          <div className="rounded-2xl border border-white/10 bg-[#121212] p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">{t("coachCompliance.stats.title")}</h2>
            <p className="text-sm opacity-60 mb-6">{t("coachCompliance.stats.subtitle")}</p>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-400 font-semibold">{t("coachCompliance.stats.completed")}</span>
                <span className="text-xl font-bold text-emerald-400">12</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-500/10 border border-gray-500/20">
                <span className="text-gray-300 font-semibold">{t("coachCompliance.stats.skipped")}</span>
                <span className="text-xl font-bold text-gray-300">3</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="text-red-400 font-semibold">{t("coachCompliance.stats.missed")}</span>
                <span className="text-xl font-bold text-red-400">1</span>
              </div>
            </div>
          </div>
        </div>

        {/* BANKA RESTOV */}
        <div className={PANEL_STACK}>
          <div className="rounded-2xl border border-white/10 bg-[#121212] p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">{t("coachCompliance.bank.title")}</h2>
            <p className="text-sm opacity-60 mb-6">{t("coachCompliance.bank.subtitle")}</p>
            
            <div className="space-y-3">
              {/* Tu bude mapovanie skipped tréningov */}
              <div className="p-4 border border-white/10 bg-white/5 rounded-xl text-center text-sm opacity-50 italic">
                {t("coachCompliance.bank.empty")}
              </div>
            </div>
          </div>
        </div>

      </div>
    </PageShell>
  );
}