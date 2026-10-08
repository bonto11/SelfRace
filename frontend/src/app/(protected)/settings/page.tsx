"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
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
        {slot("notifications", <NotificationPanel />)}
        {slot("trainer", <TrainerAthletesPanel />)}
        {slot("account", <AccountPanel />)}
      </div>
    </PageShell>
  );
}
