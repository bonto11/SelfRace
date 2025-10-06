"use client";

import TableMetrics from "@/features/profile/components/TableMetrics";
import TableHistory from "@/features/profile/components/TableHistory";
import TrendVO2Max from "@/features/profile/components/TrendVO2Max";
import TrendBodyFat from "@/features/profile/components/TrendBodyFat";
// prípadne Static ak ho chceš vidieť
import TableStatic from "@/features/profile/components/TableStatic";

export default function ClientPage() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">User profile</h1>

      <div className="flex gap-4 mt-6">
        <div className="w-1/2">
          <TrendVO2Max />
        </div>
        <div className="w-1/2">
          <TrendBodyFat />
        </div>
      </div>
      <TableStatic />
      <TableMetrics />
      <TableHistory />
    </div>
  );
}