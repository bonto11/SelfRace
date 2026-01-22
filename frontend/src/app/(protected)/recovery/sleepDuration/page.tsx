"use client";

import dynamic from "next/dynamic";
import ButtonBack from "@/app/shared/components/ui/AppHeader";

// dynamický import komponentu s grafom
const SleepDurationDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendSleepDuration"),
  { ssr: false }
);

export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="Detail - Sleep Duration" />
      <div className="pt-3">
        <SleepDurationDetailClient />
      </div>
    </div>
  );
}
