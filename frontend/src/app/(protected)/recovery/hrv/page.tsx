// src/app/(protected)/recovery/hrv/page.tsx
"use client";

import dynamic from "next/dynamic";
import PageShell from "@/app/shared/ui/components/PageShell";

const HRVDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendHRV"),
  { ssr: false }
);

export default function Page() {
  return (
    <PageShell title="Detail — HRV" showBack>
      <HRVDetailClient />
    </PageShell>
  );
}
