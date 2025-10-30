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
<<<<<<< HEAD
          ← Späť
=======
          ← Späť na Coach
>>>>>>> a3543a59040f3f0578c89f8455636271903f03d5
        </Link>
      </div>

      <AccordionBests />
    </CoachDataProvider>
  );
}