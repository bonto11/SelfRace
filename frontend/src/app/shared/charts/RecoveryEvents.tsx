import React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";

// Komponent pre vykreslenie ikon (🍷, 🍔, ☕) pod bodom grafu (custom shape pre Recharts)
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
          // Odsadenie nadol: prvá ikona je 18px pod bodom, ďalšie sa skladajú po 16px pod ňu
          y={cy + 18 + index * 16}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="13"
        >
          {emoji}
        </text>
      ))}
    </g>
  );
};

// Pomocný komponent do Tooltipu (zobrazí vysvetlivky pri prejdení myšou)
export const TooltipEvents = ({ payload }: { payload: any }) => {
  const { hasAlcohol, hasFood, hasCaffeine } = payload || {};
  const hasAnyEvent = hasAlcohol || hasFood || hasCaffeine;

  if (!hasAnyEvent) return null;

  return (
    <div
      className="mt-2 pt-2 border-t flex gap-2 text-base"
      style={{ borderColor: appColors.divider }}
    >
      {hasAlcohol && <span title="Alkohol">🍷</span>}
      {hasFood && <span title="Ťažké jedlo neskoro">🍔</span>}
      {hasCaffeine && <span title="Kofeín neskoro">☕</span>}
    </div>
  );
};