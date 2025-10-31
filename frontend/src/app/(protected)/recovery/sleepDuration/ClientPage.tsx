"use client";

import dynamic from "next/dynamic";
import { RecoveryDataProvider } from "@/shared/components/dataProviders/RecoveryDataProvider";
import ButtonBack from "@/shared/components/ui/ButtonBack";

// dynamický import komponentu s grafom
const SleepDurationDetailClient = dynamic(
  () => import("@/features/recovery/components/DetailSleepDuration"),
  { ssr: false }
);

export default function Page() {
  return (
    <RecoveryDataProvider days={90}>
      <div className="max-w-screen-lg mx-auto px-3">
        <ButtonBack title="Recovery — Sleep Duration" href="/recovery" label="Späť na Recovery" />
        <div className="pt-3">
          <SleepDurationDetailClient />
        </div>
      </div>
    </RecoveryDataProvider>
  );
}