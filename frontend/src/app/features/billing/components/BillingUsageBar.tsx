"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import type { BillingUsageBarProps } from "@/app/features/billing/types/billing";

function pickColor(pct: number) {
  if (pct >= 90) return appColors.statusError || "#ef4444";
  if (pct >= 75) return appColors.statusWarning || "#f59e0b";
  return appColors.brandPrimary; 
}

export default function BillingUsageBar({ aiQuota }: BillingUsageBarProps) {
  const t = useT();

  if (!aiQuota || !aiQuota.limits) {
    return (
      <div className="text-[10px] opacity-50 italic text-center sm:text-right">
        {t("subscription.usage.noLimitDefined" as any) || "Limity nie sú definované"}
      </div>
    );
  }

  const { limits, usage } = aiQuota;

  const isVipInput = limits.input > 10_000_000;
  const isVipOutput = limits.output > 2_000_000;

  const inputUsed = Math.max(0, usage.input ?? 0);
  const inputLimit = Math.max(0, limits.input ?? 0);
  const inputPct = inputLimit > 0 && !isVipInput ? Math.min(100, Math.round((inputUsed / inputLimit) * 100)) : 0;

  const outputUsed = Math.max(0, usage.output ?? 0);
  const outputLimit = Math.max(0, limits.output ?? 0);
  const outputPct = outputLimit > 0 && !isVipOutput ? Math.min(100, Math.round((outputUsed / outputLimit) * 100)) : 0;

  return (
    <div className="w-full flex flex-col gap-2">
      {/* INPUT */}
      <div>
        <div className="flex justify-between items-end mb-0.5">
          <span className="text-[9px] font-bold uppercase opacity-60">Analýza dát</span>
          <span className="text-[9px] font-mono opacity-50">{isVipInput ? "∞" : `${inputPct}%`}</span>
        </div>
        <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${isVipInput ? 100 : inputPct}%`, background: pickColor(inputPct) }} />
        </div>
      </div>

      {/* OUTPUT */}
      <div>
        <div className="flex justify-between items-end mb-0.5">
          <span className="text-[9px] font-bold uppercase opacity-60">Tvorba plánov</span>
          <span className="text-[9px] font-mono opacity-50">{isVipOutput ? "∞" : `${outputPct}%`}</span>
        </div>
        <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${isVipOutput ? 100 : outputPct}%`, background: pickColor(outputPct) }} />
        </div>
      </div>
    </div>
  );
}
