// src/shared/components/ActivitySelector.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetchActivitiesAround } from "@/app/features/activities/api/activities_summary";
import type {
  MiniActivity,
  SportFE,
} from "@/app/features/activities/types/activities";
import { FIELD_HELP } from "@/app/shared/ui/tokens";
import { fmtShortDate } from "@/app/shared/utils/time";
import { useT } from "@/app/shared/i18n/useT";
import SelectField from "@/app/shared/ui/components/SelectField";

type Props = {
  userId: number | null;
  dateIso: string | "";
  sports?: SportFE[];
  deltaDays?: number;
  value: number | ""; // selected activity_id ("" = none)
  onChange: (id: number | "") => void;
  onPicked?: (a: MiniActivity | null) => void;
  className?: string;
  variant?: "default" | "compact";
};

export default function ActivitySelector({
  userId,
  dateIso,
  sports,
  deltaDays = 1,
  value,
  onChange,
  onPicked,
  className = "",
  variant = "default",
}: Props) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MiniActivity[]>([]);
  const disabled = !userId || !dateIso;
  const preloadDoneRef = useRef(false);

  async function loadActivities() {
    if (!userId || !dateIso) return [] as MiniActivity[];

    try {
      return await apiFetchActivitiesAround(userId, {
        date: dateIso,
        deltaDays,
        sports,
      });
    } catch (err: any) {
      console.error("Failed to load around activities:", err?.message);
      return [] as MiniActivity[];
    }
  }

  useEffect(() => {
    if (disabled) return;
    let alive = true;
    setLoading(true);
    loadActivities()
      .then((arr) => {
        if (alive) setItems(arr);
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [disabled, userId, dateIso, deltaDays, JSON.stringify(sports)]);

  useEffect(() => {
    if (!userId || !dateIso || !value || preloadDoneRef.current) return;
    preloadDoneRef.current = true;
    let alive = true;

    (async () => {
      try {
        const arr = await loadActivities();
        if (!alive) return;
        setItems(arr);
        const hit = arr.find((a) => String(a.id) === String(value));
        if (onPicked) {
          if (hit) {
            onPicked(hit);
          } else {
            const phantom: MiniActivity = {
              id: Number(value),
              name: t("activitySelector.unknownActivity"),
              sport: (sports?.[0] ?? "run") as SportFE,
              start_date: `${dateIso}T00:00:00Z`,
              distance_km: null,
            };
            onPicked(phantom);
          }
        }
      } catch {
        if (onPicked) {
          const phantom: MiniActivity = {
            id: Number(value),
            name: t("activitySelector.unknownActivity"),
            sport: (sports?.[0] ?? "run") as SportFE,
            start_date: `${dateIso}T00:00:00Z`,
            distance_km: null,
          };
          onPicked(phantom);
        }
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dateIso, value]);

  const sportsStr = sports?.join(", ") ?? "run, mixed";

  // 🌟 Vytvoríme formát dát (Options) presne tak, ako ho žiada SelectField
  const defaultLabel = disabled
    ? t("activitySelector.pickDateFirst") || "Najprv vyberte dátum"
    : loading
      ? t("common.loading") || "Načítava sa..."
      : t("activitySelector.noActivity") || "— žiadny tréning —";

  const options = [
    { value: "", label: defaultLabel },
    ...items.map((a) => {
      const dateLabel = fmtShortDate(a.start_date);
      const dist = a.distance_km != null ? `(${a.distance_km} km)` : "";
      const suffix = [dist, dateLabel].filter(Boolean).join(" · ");

      return {
        value: String(a.id),
        label: `${a.name} ${suffix}`.trim(),
      };
    }),
  ];

  return (
    <div className={className}>
      {/* 🌟 Tu sme nasadili tvoj custom komponent */}
      <SelectField
        value={value === "" ? "" : String(value)}
        disabled={disabled || loading}
        options={options}
        onValueChange={(newVal) => {
          const id = newVal ? Number(newVal) : "";
          onChange(id);

          if (onPicked) {
            const picked = newVal
              ? (items.find((x) => String(x.id) === newVal) ?? null)
              : null;
            onPicked(picked);
          }
        }}
      />

      {!disabled && variant === "default" && (
        <div className={FIELD_HELP}>
          {t("activitySelector.helpText")
            ?.replace("{{days}}", String(deltaDays))
            ?.replace("{{sports}}", sportsStr)}
        </div>
      )}
    </div>
  );
}