// src/app/shared/components/ActivitySelectorDate.tsx
"use client";

import React, { useState } from "react";
import ActivitySelector from "@/app/shared/components/ActivitySelector";
import DateField from "@/app/shared/ui/components/DateField"; // 🌟 Použijeme DateField z tvojich tokens
import type { MiniActivity, SportFE } from "@/app/features/activities/types/activities";
import { useT } from "@/app/shared/i18n/useT";

type Props = {
  userId: number | null;
  defaultDateIso: string;
  sports?: SportFE[];
  value: number | ""; 
  onChange: (id: number | "") => void;
  onPicked?: (a: MiniActivity | null) => void;
  className?: string;
};

export default function ActivitySelectorDate({
  userId,
  defaultDateIso,
  sports,
  value,
  onChange,
  onPicked,
  className = "",
}: Props) {
  const t = useT();
  
  const [searchDate, setSearchDate] = useState<string>(
    defaultDateIso || new Date().toISOString().slice(0, 10)
  );

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      
      {/* 1. KROK: Výber dátumu pomocou tvojho DateField */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">
          {t("common.date") || "Dátum aktivity"}
        </label>
        <DateField
          value={searchDate}
          onChange={(v) => {
            if (v) {
              setSearchDate(v);
              onChange(""); // Resetneme výber pri zmene dátumu
            }
          }}
          variant="editable"
        />
      </div>

      {/* 2. KROK: Samotný výber aktivity z daného dňa */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">
          {t("calendar.activity") || "Nájdené aktivity"}
        </label>
        <ActivitySelector
          userId={userId}
          dateIso={searchDate}
          sports={sports}
          deltaDays={2}
          value={value}
          onChange={onChange}
          onPicked={onPicked}
        />
      </div>
      
    </div>
  );
}
