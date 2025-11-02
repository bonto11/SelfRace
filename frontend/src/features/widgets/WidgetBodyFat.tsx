"use client";

import * as React from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";

type Props = {
  onOpen?: () => void;
  onOpenDetail?: () => void; // alias
};

type MetricsRow = { updated_at: string; body_fat_pct: number | null };

export default function WidgetBodyFat({ onOpen, onOpenDetail }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const { userId } = useUserId();
  const [loading, setLoading] = React.useState(true);
  const [latest, setLatest] = React.useState<MetricsRow | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/profile/metrics/history/${userId}`, { cache: "no-store" });
        const js = await res.json().catch(() => ({}));
        if (!alive) return;
        const rows: MetricsRow[] = Array.isArray(js?.data) ? js.data : [];
        const last = rows
          .filter((r) => r.body_fat_pct != null)
          .slice(-1)[0] ?? null;
        setLatest(last ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const pct = latest?.body_fat_pct;

  return (
    <WidgetCard
      title="Body Fat %"
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent="bg-orange-400"
      minH={160}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="text-4xl font-extrabold tabular-nums">
            {pct != null ? pct.toFixed(1) : "—"}
            <span className="text-base align-top ml-1">%</span>
          </div>
          <div className="text-right text-xs opacity-70">
            {latest?.updated_at
              ? `aktualizované ${new Date(latest.updated_at).toLocaleDateString("sk-SK")}`
              : "bez dátumu"}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}