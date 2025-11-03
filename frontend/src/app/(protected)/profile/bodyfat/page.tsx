// src/app/(protected)/trends/vo2max/page.tsx
"use client";
import ButtonBack from "@/shared/components/ui/ButtonBack";
import TrendBodyFat from "@/features/profile/components/TrendBodyFat";
export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="Detail - Body Fat" />
      <div className="mt-3"><TrendBodyFat /></div>
    </div>
  );
}