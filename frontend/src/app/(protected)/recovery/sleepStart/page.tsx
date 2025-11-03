"use client";

import dynamic from "next/dynamic";
import ButtonBack from "@/shared/components/ui/ButtonBack";

// dynamický import komponentu s grafom
const SleepStartDetailClient = dynamic(
  () => import("@/features/recovery/components/TrendSleepStart"),
  { ssr: false }
);

export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="Detail — Sleep Start" />
      <div className="pt-3">
        <SleepStartDetailClient />
      </div>
    </div>
  );
}
