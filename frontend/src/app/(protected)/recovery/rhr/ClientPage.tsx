"use client";

import dynamic from "next/dynamic";
import { RecoveryDataProvider } from "@/features/recovery/data/RecoveryDataProvider";

// dynamický import komponentu s grafom
const RHRDetailClient = dynamic(
  () => import("@/features/recovery/components/DetailRHR"),
  { ssr: false }
);

export default function Page() {
  return (
    <RecoveryDataProvider days={90}>
      <div className="p-4">
        <RHRDetailClient />
      </div>
    </RecoveryDataProvider>
  );
}
