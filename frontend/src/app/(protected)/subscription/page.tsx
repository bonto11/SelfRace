// src/app/(protected)/subscription/page.tsx
"use client";

import { Suspense } from "react";
import PageShell from "@/app/shared/ui/components/PageShell";
import BillingPanel from "@/app/features/billing/components/BillingPanel";
import { useT } from "@/app/shared/i18n/useT";

export default function SubscriptionPage() {
  const t = useT();
  return (
    <PageShell title={t("subscription.title")} showBack={false} showPoweredByStrava={false}>
      {/* Vercel build vyžaduje Suspense pre komponenty používajúce useSearchParams() */}
      <Suspense fallback={<div className="p-4 opacity-50">Načítavam...</div>}>
        <BillingPanel />
      </Suspense>
    </PageShell>
  );
}