"use client";

import { useState, type ReactNode } from "react";

import PageShell from "@/app/shared/ui/components/PageShell";
import { InputsCardControlContext } from "@/app/shared/ui/components/InputsCard";
import { useT } from "@/app/shared/i18n/useT";

import PrefsPanel from "@/app/features/settings/components/PrefsPanel";
import NotificationPanel from "@/app/features/settings/components/NotificationPanel";
import AccountPanel from "@/app/features/settings/components/AccountPanel";

type SectionKey = "prefs" | "notifications" | "account";

export default function AccountPage() {
  const t = useT();
  // Akordeón ako v tréningových preferenciách – otvorená je vždy len jedna sekcia.
  const [openKey, setOpenKey] = useState<SectionKey | null>(null);

  const slot = (key: SectionKey, node: ReactNode) => (
    <InputsCardControlContext.Provider
      key={key}
      value={{
        open: openKey === key,
        onOpenChange: (o) => setOpenKey(o ? key : null),
      }}
    >
      {node}
    </InputsCardControlContext.Provider>
  );

  return (
    <PageShell
      title={t("settings.title")}
      showBack={false}
      showPoweredByStrava={false}
    >
      <div className="space-y-3 pb-12 mt-4">
        {slot("prefs", <PrefsPanel />)}
        {slot("notifications", <NotificationPanel />)}
        {slot("account", <AccountPanel />)}
      </div>
    </PageShell>
  );
}
