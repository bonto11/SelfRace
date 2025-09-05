"use client";

import ActivityTable from "@/components/Activity/ActivityTable";

export default function ActivitiesPage() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Aktivity – posledný mesiac</h1>
      <ActivityTable />
    </div>
  );
}
