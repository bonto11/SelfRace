// src/app/shared/components/ActivitySelectorDate.tsx
"use client";

import React, { useState } from "react";
import ActivitySelector from "@/app/shared/components/ActivitySelector";
import type { MiniActivity, SportFE } from "@/app/features/activities/types/activities";
import { FIELD_READONLY_BASE } from "@/app/shared/ui/tokens"; 
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
  
  // Defaultne predvyplníme dátum tréningu, ale dá sa zmeniť!
  const [searchDate, setSearchDate] = useState<string>(
    defaultDateIso || new Date().toISOString().slice(0, 10)
  );

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      
      {/* 1. KROK: Výber dátumu */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">
          {t("common.date") || "Dátum aktivity"}
        </label>
        <input
          type="date"
          value={searchDate}
          onChange={(e) => {
            setSearchDate(e.target.value);
            // Ak užívateľ zmení dátum, resetneme predchádzajúci výber aktivity
            onChange(""); 
          }}
          className={FIELD_READONLY_BASE}
        />
      </div>

      {/* 2. KROK: Samotný výber aktivity z daného dňa */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">
          {t("calendar.activity") || "Aktivita"}
        </label>
        <ActivitySelector
          userId={userId}
          dateIso={searchDate} // 🌟 Posielame mu aktuálne zvolený dátum
          sports={sports}
          deltaDays={2} // Pre istotu ukážeme aktivity +/- 2 dni okolo zvoleného dátumu
          value={value}
          onChange={onChange}
          onPicked={onPicked}
        />
      </div>
      
    </div>
  );
}
