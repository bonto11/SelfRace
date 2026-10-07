"use client";

import { ScanLine } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { usePerformanceExtras } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { WK } from "@/app/shared/ui/tokens/widgets";
import {
  Hero,
  IconTile,
  MiniStat,
  Pill,
  WidgetEmpty,
  WidgetLoading,
  toneColor,
  type Tone,
} from "@/app/shared/ui/widget/WidgetParts";
import type { BodyScan } from "@/app/features/performance/types/bodyScan";
import { fmt1, fmtShortDate, performanceInfo } from "@/app/features/performance/utils/performanceWidget";
import { localeTag } from "@/app/shared/i18n/locale";

type Props = { onOpen?: () => void; onOpenDetail?: () => void };

/** InBody skóre: 80+ = dobre stavané telo, 70–79 priemer, pod 70 je čo zlepšovať */
function scoreTone(score: number | null): { tone: Tone; key: "good" | "ok" | "low" } | null {
  if (score == null) return null;
  if (score >= 80) return { tone: "good", key: "good" };
  if (score >= 70) return { tone: "info", key: "ok" };
  return { tone: "warn", key: "low" };
}

export default function WidgetBodyScan({ onOpen, onOpenDetail }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = localeTag(settings?.language);
  const { bodyScan } = usePerformanceExtras();
  useEnsure(bodyScan);
  const scan: BodyScan | null = bodyScan.data ?? null;
  const loading = !bodyScan.loaded;
  const score = scan?.inbody_score ?? null;
  const st = scoreTone(score);

  return (
    <WidgetCard
      title={t("bodyScan.widget.title")}
      tooltip={performanceInfo(t, "bodyScan")}
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent="none"
      minH={160}
    >
      {loading ? (
        <WidgetLoading />
      ) : !scan ? (
        <WidgetEmpty icon={ScanLine} text={t("bodyScan.widget.empty")} />
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={ScanLine} color={st ? toneColor(st.tone) : undefined} />}
            value={score ?? "—"}
            unit={score != null ? "/ 100" : undefined}
            sub={fmtShortDate(scan.scan_date, locale) || undefined}
            right={st ? <Pill tone={st.tone} label={t(`performanceWidgets.scan.${st.key}` as any)} /> : null}
          />
          <div className="grid grid-cols-3 gap-2">
            <MiniStat value={`${fmt1(scan.weight_kg, locale)} ${t("common.units.kg")}`} label={t("performanceWidgets.weight")} />
            <MiniStat value={`${fmt1(scan.pbf_percent, locale)} %`} label={t("bodyScan.widget.pbf")} />
            <MiniStat
              value={`${fmt1(scan.skeletal_muscle_mass_kg, locale)} ${t("common.units.kg")}`}
              label={t("bodyScan.widget.smm")}
            />
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
