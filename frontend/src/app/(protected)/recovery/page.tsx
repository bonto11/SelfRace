"use client";

import RecoveryForm from "@/components/Recovery/Form";
import RecoveryTable from "@/components/Recovery/Table";
import TrendRHR from "@/components/Recovery/TrendRHR";
import TrendHRV from "@/components/Recovery/TrendHRV";
import TrendSleepDuration from "@/components/Recovery/TrendSleepDuration";
import TrendSleepStart from "@/components/Recovery/TrendSleepStart";

export default function RecoveryPage() {
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