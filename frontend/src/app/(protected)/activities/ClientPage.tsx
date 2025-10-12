"use client";

import { useState } from "react";
import ActivityTable from "@/features/activity/components/ActivityTable";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import WeeklyLoadWidget, { WeekPick } from "@/features/widgets/WeeklyLoadWidget";
import MonoStrainWidget from "@/features/widgets/MonoStrainWidget";
import TrendWeeklyLoad from "@/features/activity/components/TrendWeeklyLoad";

/* jednoduchý modál na spoločný trend */
function DetailModal({
  open, onClose, onPickWeek,
}: {
  open: boolean;
  onClose: () => void;
  onPickWeek: (w: WeekPick) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
      <div className="bg-gray-900 text-gray-100 w-full max-w-6xl max-h-[92vh] rounded shadow-lg overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <div className="font-semibold">Detail – Weekly Load</div>
          <button onClick={onClose} className="px-2 py-1 bg-gray-700 rounded text-sm">Zavrieť</button>
        </div>
        <div className="p-3 overflow-auto">
          {/* spoločný komponent – prepínače športov + rozsah (2t/1–3m) */}
          <TrendWeeklyLoad onPickWeek={onPickWeek} />
        </div>
      </div>
    </div>
  );
}

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
  const [picked, setPicked] = useState<WeekPick | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WeeklyLoadWidget
          title="Týždenná záťaž (čas)"
          onPickWeek={(w) => setPicked(w)}
          onOpenDetail={() => setDetailOpen(true)}
        />
        <MonoStrainWidget
          title="Indexy záťaže"
          onOpenDetail={() => setDetailOpen(true)}
        />
      </div>

      {/* tabuľka podľa vybraného týždňa */}
      <div className="mt-6">
        <ActivityTable start={picked?.start} end={picked?.end} />
      </div>

      {/* detailný trend v modáli – zdieľané pre oba widgety */}
      <DetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onPickWeek={(w) => { setPicked(w); }}
      />

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
