"use client";

import ButtonBack from "@/shared/components/ui/ButtonBack";
import CoachPlanActions from "@/features/coach/components/CoachPlanActions";

export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="Coach — Plan" />
      <div className="pt-3">
        <CoachPlanActions />
      </div>
    </div>
  );
}