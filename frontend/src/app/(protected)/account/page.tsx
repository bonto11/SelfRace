// src/app/(protected)/account/page.tsx
import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

import SettingsInputs from "@/app/features/account/components/SettingsInputs";
import BillingPanel from "@/app/features/billing/components/BillingPanel";

export default function AccountPage() {
  return (
    <>
      <AppHeader title="Účet & nastavenia" showBack={false} container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <div className={PAGE_STACK}>
            <SettingsInputs />
            <BillingPanel />
          </div>
        </div>
      </div>
    </>
  );
}