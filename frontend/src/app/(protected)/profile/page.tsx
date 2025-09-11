"use client";

import TableMetrics from "@/components/Profile/TableMetrics";
import TableHistory from "@/components/Profile/TableHistory";
import TrendVO2Max from "@/components/Profile/TrendVO2Max";
import TrendRHR from "@/components/Profile/TrendRHR";
import TrendBodyFat from "@/components/Profile/TrendBodyFat";
// prípadne Static ak ho chceš vidieť
import TableStatic from "@/components/Profile/TableStatic";

export default function ProfilePage() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">User profile</h1>

      <div className="flex gap-4 mt-6">
        <div className="w-1/2">
          <TrendVO2Max />
        </div>
        <div className="w-1/2">
          <TrendRHR />
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