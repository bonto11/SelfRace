"use client";

import TrendPareto8020 from "@/features/activity/components/TrendPareto8020";

export default function ParetoPage() {
  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Aktivity – 80/20</h1>
      <TrendPareto8020 />
    </div>
  );
}