"use client";

import Link from "next/link";
import { ChevronRight, LayoutGrid } from "lucide-react";

import PageShell from "@/app/shared/ui/components/PageShell";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { useCardAccordion } from "@/app/shared/ui/components/useCardAccordion";
import { useT } from "@/app/shared/i18n/useT";

import NotificationPanel from "@/app/features/settings/components/NotificationPanel";
import AccountPanel from "@/app/features/settings/components/AccountPanel";
import TrainerAthletesPanel from "@/app/features/trainer/components/TrainerAthletesPanel";

export default function AccountPage() {
  const t = useT();
  // Jazyk sa mení v user menu (ikony vlajok). Osobné nastavenia (jednotky,
  // časové pásmo, začiatok týždňa…) sa v appke nikde nepoužívali, preto sú preč.
  const slot = useCardAccordion<"notifications" | "trainer" | "account">();

  return (
    <PageShell
      title={t("settings.title")}
      showBack={false}
      showPoweredByStrava={false}
    >
      <div className="space-y-3 pb-12 mt-4">
        {/* výber widgetov má vlastnú stránku – zoznam je dlhý */}
        <Link
          href="/settings/widgets"
          className={[CARD, "flex items-center gap-3 p-4 transition-colors"].join(" ")}
          style={SURFACE_CARD_STYLE}
        >
          <span
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.surfaceCardBorder}` }}
          >
            <LayoutGrid size={18} color={appColors.brandPrimary} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-base font-bold" style={{ color: appColors.textPrimary }}>
              {t("widgetCatalog.title")}
            </span>
            <span className="block text-xs mt-0.5" style={{ color: appColors.textMuted }}>
              {t("widgetCatalog.settingsHint")}
            </span>
          </span>
          <ChevronRight size={18} color={appColors.textMuted} />
        </Link>
        {slot("notifications", <NotificationPanel />)}
        {slot("trainer", <TrainerAthletesPanel />)}
        {slot("account", <AccountPanel />)}
      </div>
    </PageShell>
  );
}
