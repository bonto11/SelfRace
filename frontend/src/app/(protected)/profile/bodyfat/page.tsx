// src/app/(protected)/trends/vo2max/page.tsx
"use client";
import ButtonBack from "@/app/shared/components/ui/AppHeader";
import TrendBodyFat from "@/app/features/profile/components/TrendBodyFat";
export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="Detail - Body Fat" />
      <div className="mt-3">
        <TrendBodyFat />
      </div>
    </div>
  );
}
