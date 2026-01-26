// src/app/(protected)/recovery/rhr/page.tsx
"use client";

import dynamic from "next/dynamic";
import PageShell from "@/app/shared/components/components/PageShell";

const RHRDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendRHR"),
  { ssr: false }
);

export default function Page() {
  return (
    <PageShell title="Detail — Resting Heart Rate (RHR)" showBack>
      <RHRDetailClient />
    </PageShell>
  );
}
