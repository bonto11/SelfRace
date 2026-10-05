"use client";

import type { ReactNode } from "react";

import CardBackdrop from "@/app/shared/ui/components/CardBackdrop";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  CARD,
  CARD_BODY_INSET,
  CARD_HEAD_INSET,
  SURFACE_CARD_STYLE,
} from "@/app/shared/ui/tokens";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** pravý horný roh – prepínač alebo stav */
  right?: ReactNode;
  children?: ReactNode;
};

/** Spoločná karta pre jednu pripojenú aplikáciu (Strava, intervals.icu…). */
export default function ConnectedAppCard({ title, subtitle, right, children }: Props) {
  return (
    <section className={[CARD, "relative overflow-hidden"].join(" ")} style={SURFACE_CARD_STYLE}>
      <CardBackdrop />
      <div className={`${CARD_HEAD_INSET} relative`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold" style={{ color: appColors.textPrimary }}>
              {title}
            </h2>
            {subtitle ? (
              <p className="text-xs mt-1 leading-relaxed" style={{ color: appColors.textMuted }}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {right ? <div className="shrink-0 pt-0.5">{right}</div> : null}
        </div>
      </div>
      {children ? <div className={`${CARD_BODY_INSET} relative pt-2`}>{children}</div> : null}
    </section>
  );
}
