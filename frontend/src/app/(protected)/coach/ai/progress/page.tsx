"use client";

import ButtonBack from "@/app/shared/components/ui/ButtonBack";
import DetailAthleteProgress from "@/app/features/coach/components/DetailAthleteProgress";

export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="Weekly progress" />
      <div className="pt-3">
        <DetailAthleteProgress />
      </div>
    </div>
  );
}