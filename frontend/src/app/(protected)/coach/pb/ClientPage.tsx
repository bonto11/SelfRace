"use client";
import Link from "next/link";
import { CoachDataProvider } from "@/features/coach/data/CoachDataProvider";
import AccordionBests from "@/features/coach/components/pb/AccordionBests";

export default function ClientPage() {
  return (
    <CoachDataProvider>
      <div className="max-w-screen-lg mx-auto px-3 overflow-x-hidden">
        <h1 className="text-lg font-semibold">Personal Bests</h1>
        <Link
          href="/coach"
          className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600"
        >
          ← Späť
        </Link>
      </div>

      <AccordionBests />
    </CoachDataProvider>
  );
}