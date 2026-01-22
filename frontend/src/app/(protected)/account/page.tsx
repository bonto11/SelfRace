// src/app/(protected)/account/page.tsx
import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";
import { PAGE_INTRO, PAGE_INTRO_TITLE, PAGE_INTRO_TEXT } from "@/app/shared/ui/tokens/pageIntro";

import PersonalSettingsPanel from "@/app/features/account/components/PersonalSettingsPanel";
import BillingPanel from "@/app/features/billing/components/BillingPanel";

export default function AccountPage() {
  return (
    <>
      <AppHeader title="Account & Settings" showBack={false} container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <header className={PAGE_INTRO}>
            <h2 className={PAGE_INTRO_TITLE}>Account & Settings</h2>
            <p className={PAGE_INTRO_TEXT}>
              Nastav si účet, preferencie aplikácie a sprav svoje subscription tiers
              a AI limity.
            </p>
          </header>

          <div className={PAGE_STACK}>
            <PersonalSettingsPanel />
            <BillingPanel />
          </div>
        </div>
      </div>
    </>
  );
}