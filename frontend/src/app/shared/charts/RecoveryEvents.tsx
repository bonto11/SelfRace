// src/app/shared/charts/RecoveryEvents.tsx
import React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";

// 1. Ikonky na samotnej krivke grafu
export const EventsIcon = (props: any) => {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;

  const events = [];
  if (payload.hasAlcohol) events.push("🍷");
  if (payload.hasFood) events.push("🍔");
  if (payload.hasCaffeine) events.push("☕");

  if (events.length === 0) return null;

  return (
    <g>
      {events.map((emoji, index) => (
        <text
          key={index}
          x={cx}
          y={cy + 18 + index * 16}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="13"
          style={{ cursor: "default" }}
        >
          {emoji}
        </text>
      ))}
    </g>
  );
};

// 2. Obsah v čiernom Tooltipe po prejdení myšou
export const TooltipEvents = ({ payload, t }: { payload: any, t: any }) => {
  const { hasAlcohol, hasFood, hasCaffeine } = payload || {};
  const hasAnyEvent = hasAlcohol || hasFood || hasCaffeine;

  if (!hasAnyEvent) return null;

  return (
    <div
      className="mt-2 pt-2 border-t flex flex-col gap-1 text-xs"
      style={{ borderColor: appColors.divider, color: appColors.textMuted }}
    >
      {hasAlcohol && (
        <div className="flex items-center gap-2">
          <span>🍷</span> <span>{t("recovery.trends.events.alcohol") || "Alkohol"}</span>
        </div>
      )}
      {hasFood && (
        <div className="flex items-center gap-2">
          <span>🍔</span> <span>{t("recovery.trends.events.food") || "Ťažké jedlo"}</span>
        </div>
      )}
      {hasCaffeine && (
        <div className="flex items-center gap-2">
          <span>☕</span> <span>{t("recovery.trends.events.caffeine") || "Kofeín"}</span>
        </div>
      )}
    </div>
  );
};

// 3. Nová drobná legenda, ktorú vložíme úplne dole pod graf
export const EventsLegend = ({ t }: { t: any }) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-[10px] opacity-70">
      <div className="flex items-center gap-1">
        <span>🍷</span> <span>{t("recovery.trends.events.alcohol") || "Alkohol"}</span>
      </div>
      <div className="flex items-center gap-1">
        <span>🍔</span> <span>{t("recovery.trends.events.food") || "Ťažké jedlo"}</span>
      </div>
      <div className="flex items-center gap-1">
        <span>☕</span> <span>{t("recovery.trends.events.caffeine") || "Kofeín"}</span>
      </div>
    </div>
  );
};