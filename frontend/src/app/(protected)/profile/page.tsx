"use client";

import TableMetrics from "@/components/Profile/TableMetrics";
import TableHistory from "@/components/Profile/TableHistory";
import TrendVO2Max from "@/components/Profile/TrendVO2Max";
// prípadne Static ak ho chceš vidieť
import TableStatic from "@/components/Profile/TableStatic";

export default function ProfilePage() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">User profile</h1>

      {/* Static údaje – voliteľné, ak ich chceš renderovať */}
      {<TableStatic />}

      {/* Metrics input */}
      <TableMetrics />

      {/* História + Trend */}
      <div className="flex gap-4 mt-6">
        <div className="w-1/2">
          <TableHistory />
        </div>
        <div className="w-1/2">
          <TrendVO2Max />
        </div>
      </div>
    </div>
  );
}