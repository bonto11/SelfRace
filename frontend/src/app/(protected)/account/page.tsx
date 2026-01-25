// src/app/(protected)/account/page.tsx
import PageShell from "@/app/shared/components/ui/PageShell";

import SettingsInputs from "@/app/features/account/components/SettingsInputs";
import BillingPanel from "@/app/features/billing/components/BillingPanel";

export default function AccountPage() {
  return (
    <PageShell title="Účet & nastavenia" showBack={false}>
      <SettingsInputs />
      <BillingPanel />
    </PageShell>
  );
}