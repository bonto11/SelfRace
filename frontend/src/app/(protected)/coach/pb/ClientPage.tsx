"use client";
import Link from "next/link";
import { CoachDataProvider } from "@/features/coach/data/CoachDataProvider";
import AccordionBests from "@/features/coach/components/pb/AccordionBests";

export default function ClientPage() {
  return (
    <CoachDataProvider>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Personal Bests</h1>
        <Link
          href="/coach"
          className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600"
        >
          ← Späť na Coach
        </Link>
      </div>

      <AccordionBests />
    </CoachDataProvider>
  );
}