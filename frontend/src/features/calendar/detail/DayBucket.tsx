"use client";

import * as React from "react";
import UnifiedRow, { UnifiedItem } from "./UnifiedRow";

type Props = {
  label: "Past" | "Planned";
  items: UnifiedItem[];
};

export default function DayBucket({ label, items }: Props) {
  if (!items.length) {
    return (
      <div className="text-sm opacity-60">
        {label === "Planned"
          ? "Žiadne plánované položky."
          : "Žiadne záznamy."}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide opacity-60">
        {label}
      </div>

      {items.map((it) => (
        <UnifiedRow key={it.id} item={it} />
      ))}
    </div>
  );
}