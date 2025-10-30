"use client";

import Link from "next/link";
import { CoachDataProvider } from "@/features/coach/data/CoachDataProvider";
import AccordionBests from "@/features/coach/components/AccordionBests";

export default function ClientPage() {
  return (
    <CoachDataProvider>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Personal Bests</h1>
          <Link href="/coach" className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm">
            Späť
          </Link>
        </div>
        <AccordionBests />
      </div>
    </CoachDataProvider>
  );
}
