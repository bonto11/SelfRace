"use client";

import RecoveryForm from "@/features/recovery/components/Form";
import RecoveryTable from "@/features/recovery/components/Table";
import TrendRHR from "@/features/recovery/components/TrendRHR";
import TrendHRV from "@/features/recovery/components/TrendHRV";
import TrendSleepDuration from "@/features/recovery/components/TrendSleepDuration";
import TrendSleepStart from "@/features/recovery/components/TrendSleepStart";

export default function ClientPage() {
  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <TrendRHR />
        <TrendHRV />
        <TrendSleepDuration />
        <TrendSleepStart />
      </div>
      <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-4">Recovery Tracking</h1>
      <RecoveryForm />
      <RecoveryTable />
      </div>
    </div>
  );
}