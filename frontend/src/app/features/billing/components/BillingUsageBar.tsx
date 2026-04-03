// src/features/billing/components/BillingUsageBar.tsx
"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

type TokenMetrics = {
  input: number;
  output: number;
};

type AiQuotaStatus = {
  limits: TokenMetrics;
  usage: TokenMetrics;
  remaining: TokenMetrics;
  is_over: boolean;
  reset_at: string | null;
};

type Props = {
  aiQuota?: AiQuotaStatus;
};

function pickColor(pct: number) {
  if (pct >= 90) return appColors.statusError;
  if (pct >= 75) return appColors.statusWarning;
  return appColors.brandPrimary; 
}

export default function BillingUsageBar({ aiQuota }: Props) {
  const t = useT();

  if (!aiQuota || !aiQuota.limits) {
    return (
      <div className="text-[11px] mt-1 opacity-50 italic">
        {t("subscription.usage.noLimitDefined")}
      </div>
    );
  }

  const { limits, usage, reset_at } = aiQuota;

  // Bezpečnostná poistka proti nekonečným (VIP) limitom
  const isVipInput = limits.input > 10_000_000;
  const isVipOutput = limits.output > 2_000_000;

  // Výpočty pre INPUT
  const inputUsed = Math.max(0, usage.input ?? 0);
  const inputLimit = Math.max(0, limits.input ?? 0);
  const inputPct = inputLimit > 0 && !isVipInput ? Math.min(100, Math.round((inputUsed / inputLimit) * 100)) : 0;

  // Výpočty pre OUTPUT
  const outputUsed = Math.max(0, usage.output ?? 0);
  const outputLimit = Math.max(0, limits.output ?? 0);
  const outputPct = outputLimit > 0 && !isVipOutput ? Math.min(100, Math.round((outputUsed / outputLimit) * 100)) : 0;

  return (
    <div className="w-full flex flex-col gap-4">
      
      {/* 1. BAR: INPUT (Analýza a čítanie) */}
      <div>
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider opacity-70 flex items-center gap-1" style={{ color: appColors.textPrimary }}>
            {/* Tieto label by si mal pridať do SK prekladov, nateraz fallback */}
            {t("subscription.usage.inputLabel") || "Analýza Dát (Input)"}
          </span>

          <span className="text-[10px] font-mono opacity-60" style={{ color: appColors.textMuted }}>
            {inputUsed.toLocaleString("sk-SK")} / {isVipInput ? "∞" : inputLimit.toLocaleString("sk-SK")}
          </span>
        </div>
        
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: appColors.buttonGhostBgHover }}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${isVipInput ? 100 : inputPct}%`, background: pickColor(inputPct) }}
          />
        </div>
      </div>

      {/* 2. BAR: OUTPUT (Generovanie) */}
      <div>
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider opacity-70 flex items-center gap-1" style={{ color: appColors.textPrimary }}>
             {t("subscription.usage.outputLabel") || "Tvorba Plánov (Output)"}
          </span>

          <span className="text-[10px] font-mono opacity-60" style={{ color: appColors.textMuted }}>
            {outputUsed.toLocaleString("sk-SK")} / {isVipOutput ? "∞" : outputLimit.toLocaleString("sk-SK")}
          </span>
        </div>
        
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: appColors.buttonGhostBgHover }}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${isVipOutput ? 100 : outputPct}%`, background: pickColor(outputPct) }}
          />
        </div>
      </div>

      {/* Spoločný reset footer */}
      {reset_at && (
        <div className="text-[10px] opacity-50 italic text-right mt-[-4px]">
          {t("subscription.usage.reset")}: {new Date(reset_at).toLocaleDateString("sk-SK")}
        </div>
      )}

    </div>
  );
}
