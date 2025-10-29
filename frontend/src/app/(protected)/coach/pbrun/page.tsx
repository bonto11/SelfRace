"use client";
import { CoachDataProvider } from "@/features/coach/data/CoachDataProvider";
import PBRunPanel from "@/features/coach/components/PBRunPanel";
import Link from "next/link";

export default function PBRunPage() {
  return (
    <CoachDataProvider>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Coach — PB Running</h1>
          <Link href="/coach" className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm">Späť</Link>
        </div>
        <PBRunPanel />
      </div>
    </CoachDataProvider>
  );
}