"use client";

import { useState } from "react";
import Link from "next/link";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import WeeklyLoadWidget from "@/features/widgets/WeeklyLoadWidget";
import MonoStrainWidget from "@/features/widgets/MonoStrainWidget";

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg">
      <div className="mb-1">{msg}</div>
      <button className="underline text-xs opacity-80" onClick={onClose}>OK</button>
    </div>
  );
}

export default function ClientPage() {
  const { userId } = useUserId();
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleSync() {
    if (!userId) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/activities/sync/${userId}`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        const imp = Number.isFinite(json.imported) ? json.imported : 0;
        const upd = Number.isFinite(json.updated) ? json.updated : 0;
        const skp = Number.isFinite(json.skipped) ? json.skipped : 0;
        setToast(`✅ Sync OK • imported: ${imp} • updated: ${upd} • skipped: ${skp}`);
      } else {
        setToast(`❌ Sync error: ${json.detail || "unknown"}`);
      }
    } catch (e: any) {
      setToast(`❌ Sync request failed: ${e?.message || e}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      {/* header */}
      <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">Aktivity</h2>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          title="Stiahnuť nové aktivity zo Stravy"
        >
          {syncing && <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
          {syncing ? "Synchronizujem…" : "Sync Strava"}
        </button>
      </div>

      {/* widgety */}
      <div className="grid gap-4">
        <WeeklyLoadWidget />

        {/* nové tlačidlo medzi widgetami */}
        <Link
          href="/activities/detail"
          className="inline-flex w-full justify-center items-center gap-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 px-3"
          title="Otvoriť detailný trend"
        >
          Otvoriť detailný trend
        </Link>

        <MonoStrainWidget />
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
