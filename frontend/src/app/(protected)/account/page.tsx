// src/app/(protected)/account/page.tsx
"use client";

import AppHeader from "@/app/shared/components/ui/AppHeader";
import {
  PAGE_CONTAINER,
  PAGE_STACK,
  PAGE_INTRO,
} from "@/app/shared/ui/tokens/pageTokens";

import PersonalSettingsPanel from "@/app/features/account/components/PersonalSettingsPanel";
import BillingPanel from "@/app/features/billing/components/BillingPanel";

export const metadata = {
  title: "Account & Settings",
};

export default function AccountPage() {
  return (
    <>
      <AppHeader title="Account & Settings" showBack={false} container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <p className={PAGE_INTRO}>
            Nastav si účet, preferencie aplikácie a sprav svoje subscription
            tiers a AI limity.
          </p>

          <PersonalSettingsPanel />
          <BillingPanel />
        </div>
      </div>
    </>
  );
}