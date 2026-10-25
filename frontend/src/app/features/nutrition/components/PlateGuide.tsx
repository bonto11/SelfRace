"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import { fmt, useT, type TKey } from "@/app/shared/i18n/useT";
import type { DayLoad } from "@/app/features/nutrition/types/nutrition";
import { PLATE_BY_LOAD, PLATE_COLOR, PLATE_PARTS } from "@/app/features/nutrition/utils/fuel";

/** výseč kruhu (SVG path) od uhla a po uhol b, stupne od 12:00 v smere hodín */
function arc(cx: number, cy: number, r: number, a: number, b: number): string {
  const p = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x1, y1] = p(a);
  const [x2, y2] = p(b);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
}

/**
 * Režim bez počítania: tanier podľa záťaže dňa + porcie rukou.
 * PREČO bez čísel: niekoho kalórie stresujú (a pri sklone k poruchám
 * príjmu potravy škodia) – tanier a ruka stačia na dobré rozhodnutia.
 */
export default function PlateGuide({ load, compact = false }: { load: DayLoad; compact?: boolean }) {
  const t = useT();
  const plate = PLATE_BY_LOAD[load];
  const size = compact ? 72 : 112;
  const c = size / 2;
  let start = 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
          <circle cx={c} cy={c} r={c - 1} fill={appColors.surfaceCardBorder} />
          {PLATE_PARTS.map((part) => {
            const deg = (plate[part] / 100) * 360;
            const d = arc(c, c, c - 4, start, start + deg);
            start += deg;
            return <path key={part} d={d} fill={PLATE_COLOR[part]} stroke={appColors.surfaceSolid} strokeWidth={2} />;
          })}
        </svg>
        <ul className="flex flex-col gap-1.5 text-sm min-w-0">
          {PLATE_PARTS.map((part) => (
            <li key={part} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PLATE_COLOR[part] }} />
              <span className="truncate" style={{ color: appColors.textSecondary }}>
                {t(`nutrition.plate.${part}` as TKey)}
              </span>
              <span className="text-xs tabular-nums" style={{ color: appColors.textMuted }}>
                {plate[part]} %
              </span>
            </li>
          ))}
        </ul>
      </div>
      {!compact ? (
        <>
          <p className="text-xs leading-relaxed" style={{ color: appColors.textSecondary }}>
            {fmt(t("nutrition.plate.hands"), { c: t(`nutrition.plate.fists.${load}` as TKey) })}
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: appColors.textMuted }}>
            {t("nutrition.plate.hint")}
          </p>
        </>
      ) : null}
    </div>
  );
}
