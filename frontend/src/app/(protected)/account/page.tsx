// src/app/(protected)/account/page.tsx
import PageShell from "@/app/shared/ui/components/PageShell";

import SettingsInputs from "@/app/features/account/components/SettingsInputs";
import BillingPanel from "@/app/features/billing/components/BillingPanel";
import { useT } from "@/app/shared/i18n/useT";

export default function AccountPage() {
  const t = useT();
  return (
    <PageShell title={t("account.title")} showBack={false} showPoweredByStrava={false}>
      <SettingsInputs />
      <BillingPanel />
    </PageShell>
  );
}
