"use client";

import dynamic from "next/dynamic";
import ButtonBack from "@/app/shared/components/ui/ButtonBack";

// dynamický import komponentu s grafom
const RHRDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendRHR"),
  { ssr: false }
);

export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="Detail — Resting Hearth Rate - RHR" />
      <div className="pt-3">
        <RHRDetailClient />
      </div>
    </div>
  );
}
