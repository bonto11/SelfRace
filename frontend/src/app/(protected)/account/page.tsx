// src/app/(protected)/account/page.tsx
import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";
import { PAGE_INTRO, PAGE_INTRO_TITLE, PAGE_INTRO_TEXT } from "@/app/shared/ui/tokens/pageTokens";

import PersonalSettingsPanel from "@/app/features/account/components/PersonalSettingsPanel";
import BillingPanel from "@/app/features/billing/components/BillingPanel";

export default function AccountPage() {
  return (
    <>
      <AppHeader title="Účet & nastavenia" showBack={false} container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <div className={PAGE_STACK}>
            <PersonalSettingsPanel />
            <BillingPanel />
          </div>
        </div>
      </div>
    </>
  );
}