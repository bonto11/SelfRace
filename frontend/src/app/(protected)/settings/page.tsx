"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";

import PrefsPanel from "@/app/features/settings/components/PrefsPanel";
import NotificationPanel from "@/app/features/settings/components/NotificationPanel";
import AccountPanel from "@/app/features/settings/components/AccountPanel";

export default function AccountPage() {
  const t = useT();

  return (
    <PageShell
      title={t("settings.title")}
      showBack={false}
      showPoweredByStrava={false}
    >
      {/* Všetky panely sú úhľadne poskladané pod sebou */}
      <div className="space-y-4 pb-12">
        <PrefsPanel />
        <NotificationPanel />
        <AccountPanel />
      </div>
    </PageShell>
  );
}
