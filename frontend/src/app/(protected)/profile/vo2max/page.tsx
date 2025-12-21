// src/app/(protected)/trends/vo2max/page.tsx
"use client";
import ButtonBack from "@/app/shared/components/ui/ButtonBack";
import TrendVO2Max from "@/app/features/profile/components/TrendVO2Max";
export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="Detail - VO₂Max" />
      <div className="mt-3">
        <TrendVO2Max />
      </div>
    </div>
  );
}
