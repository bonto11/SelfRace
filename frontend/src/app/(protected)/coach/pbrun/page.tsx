import AccordionBests from "@/features/coach/components/AccordionBests";
import Link from "next/link";

export default function CoachBestsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Personal Bests</h1>
        <Link
          href="/coach"
          className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm"
        >
          ← Back
        </Link>
      </div>

      <AccordionBests />
    </div>
  );
}