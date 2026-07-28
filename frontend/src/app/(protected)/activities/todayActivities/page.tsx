// src/app/(protected)/activities/detail/[activityId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { PANEL_PREVIEW } from "@/app/shared/ui/tokens";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";

export default function ActivityDetailPage() {
  const params = useParams();
  const activityId = params?.activityId ? Number(params.activityId) : null;

  const { getSummary, getEnrichment, getExtras } = useActivityData();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!activityId) return;
    let alive = true;
    setLoading(true);

    (async () => {
      const summary = getSummary(activityId);
      const [enrichment, extras] = await Promise.all([
        getEnrichment(activityId),
        getExtras(activityId),
      ]);
      if (!alive) return;
      setData({ summary, enrichment, extras });
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [activityId, getSummary, getEnrichment, getExtras]);

  return (
    <PageShell title="Aktivita" showBack showPoweredByStrava={false}>
      {loading ? (
        <div className="grid place-items-center py-10">
          <LoadingSpinner size="widget" />
        </div>
      ) : !data?.summary ? (
        <div className={PANEL_PREVIEW}>
          Aktivita sa nenašla (ID: {String(activityId ?? "—")}).
        </div>
      ) : (
        <pre
          className={[PANEL_PREVIEW, "whitespace-pre-wrap break-words text-xs"].join(
            " ",
          )}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </PageShell>
  );
}
