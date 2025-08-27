"use client";

import RecoveryForm from "@/components/Recovery/Form";
import RecoveryTable from "@/components/Recovery/Table";

export default function RecoveryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-4">Recovery Tracking</h1>
      <RecoveryForm />
      <RecoveryTable />
    </div>
  );
}
