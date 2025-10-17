"use client";

import dynamic from "next/dynamic";
import { RecoveryDataProvider } from "@/features/recovery/data/RecoveryDataProvider";

// dynamický import komponentu s grafom
const HRVDetailClient = dynamic(
  () => import("@/features/recovery/components/DetailHRV"),
  { ssr: false }
);

export default function Page() {
  return (
    <RecoveryDataProvider days={90}>
      <div className="p-4">
        <HRVDetailClient />
      </div>
    </RecoveryDataProvider>
  );
}
