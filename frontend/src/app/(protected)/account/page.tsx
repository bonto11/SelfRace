// src/app/(protected)/account/page.tsx
"use client";
import PageShell from "@/app/shared/ui/components/PageShell";

import SettingsInputs from "@/app/features/account/components/SettingsInputs";
import { useT } from "@/app/shared/i18n/useT";

export default function AccountPage() {
  const t = useT();
  return (
    <PageShell title={t("account.title")} showBack={false} showPoweredByStrava={false}>
      <SettingsInputs />
    </PageShell>
  );
}
