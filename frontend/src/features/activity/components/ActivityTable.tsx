// src/features/activity/components/ActivityTable.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import { API_URL } from "@/shared/config";
import { SUBCARD, CARD } from "@/shared/ui/classes";
import { toEffSport, sportUiLabel } from "@/features/activity/utils/sport";
import { THEME } from "@/shared/theme/tokens";
import ActivityDetail from "./ActivityDetail";

interface ActivityRow {
  activity_id: number;
  name: string;
  sport_type?: string | null;
  sport_type_fe?: string | null;
  sport_type_ovrd?: string | null;
  distance_m: number | null;
  moving_time_s: number | null;
  average_heartrate_bpm: number | null;
  max_heartrate_bpm: number | null;
  date: string; // ISO
}

/* --------------------- sessionStorage cache --------------------- */

const hasSS = () => typeof window !== "undefined" && !!window.sessionStorage;
const keyFor = (uid: number, start: string, end: string) => `ACT:RANGE:${uid}:${start}:${end}`;

function saveCache(uid: number, start: string, end: string, rows: ActivityRow[]) {
  if (!hasSS()) return;
  try {
    sessionStorage.setItem(
      keyFor(uid, start, end),
      JSON.stringify({ at: Date.now(), rows })
    );
  } catch (_) {}
}
function loadCache(uid: number, start: string, end: string): ActivityRow[] | null {
  if (!hasSS()) return null;
  try {
    const raw = sessionStorage.getItem(keyFor(uid, start, end));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.rows)) return parsed.rows as ActivityRow[];
  } catch (_) {}
  return null;
}

/* ----------------------------- UI ------------------------------ */

export default function ActivityTable({ start, end }: { start?: string; end?: string; }) {
  const { userId } = useUserId();

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  // “bezpečný” titulok
  const headerTitle = useMemo(
    () => (start && end ? `Týždeň ${start} → ${end}` : "História (vyber týždeň v grafe)"),
    [start, end]
  );

  const fetchRange = useCallback(async () => {
    if (!userId || !start || !end) {
      setRows([]);
      setSelectedId(null);
      return;
    }
    setLoading(true);
    try {
      // 1) cache okamžite
      const cached = loadCache(userId, start, end);
      if (cached) {
        console.log("[ACT][range] cache hit:", cached.length);
        setRows(cached);
        setLoading(false);
      }
      // 2) vždy sprav čerstvý fetch (aby sa data aktualizovali)
      const url = `${API_URL}/activities/range/${userId}?start=${start}&end=${end}`;
      console.log("[ACT][range] fetch:", url);
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const fresh: ActivityRow[] = json?.success ? (json.data ?? []) : [];
      console.log("[ACT][range] fresh count:", fresh.length);
      setRows(fresh);
      saveCache(userId, start, end, fresh);
      if (fresh.length === 0) setSelectedId(null);
    } catch (e) {
      console.error("[ACT][range] fetch error:", e);
      if (!rows.length) setRows([]); // fallback na prázdno
    } finally {
      setLoading(false);
    }
  }, [userId, start, end]);

  useEffect(() => {
    setSelectedId(null);
    if (userId && start && end) fetchRange();
  }, [userId, start, end, fetchRange]);

  async function handleSync() {
    if (!userId) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/activities/sync/${userId}`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (json?.success) {
        alert(`✅ Sync OK.\nimported: ${json.imported ?? "?"}\nupdated: ${json.updated ?? "?"}`);
        await fetchRange();
      } else {
        alert("❌ Sync error: " + (json?.detail || "unknown"));
      }
    } catch (err) {
      console.error("[ACT][sync] error:", err);
      alert("❌ Sync request error (pozri konzolu).");
    } finally {
      setSyncing(false);
    }
  }

  if (!userId) return <div>❌ User not found.</div>;

  return (
    <div className={`${CARD} space-y-4`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">{headerTitle}</h2>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {syncing && (
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          )}
          {syncing ? "Synchronizujem…" : "Sync Strava"}
        </button>
      </div>

      {/* MOBILE – karty */}
      <div className="sm:hidden space-y-2">
        {loading && <div className="opacity-70 py-4">Načítavam…</div>}
        {!loading &&
          rows.map((r) => {
            const eff = toEffSport(r);
            return (
              <button
                key={r.activity_id}
                onClick={() => setSelectedId(r.activity_id)}
                className="w-full text-left rounded border border-gray-700 p-3 bg-gray-900"
                title={r.name}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {new Date(r.date).toLocaleDateString("sk-SK")}
                  </div>
                  <div className="text-xs px-2 py-0.5 rounded bg-gray-700">
                    {sportUiLabel(eff)}
                  </div>
                </div>
                <div className="truncate opacity-90">{r.name}</div>
                <div className="mt-1 text-xs opacity-75 flex gap-3">
                  <span>{r.moving_time_s != null ? `${Math.floor((r.moving_time_s || 0) / 60)} min` : "—"}</span>
                  <span>{r.distance_m != null ? `${((r.distance_m || 0) / 1000).toFixed(1)} km` : "—"}</span>
                  <span>HR: {r.average_heartrate_bpm ?? "—"}</span>
                </div>
              </button>
            );
          })}
        {!loading && !rows.length && (
          <div className="text-center opacity-70 py-4">Žiadne aktivity.</div>
        )}
      </div>

      {/* DESKTOP – tabuľka */}
      <div className="hidden sm:block overflow-x-auto">
        <div style={{ minWidth: THEME.layout.tableMinWidth }}>
          <table className="w-full text-sm border-collapse text-center">
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-700">
                <th>Date</th>
                <th>Sport</th>
                <th>Name</th>
                <th>Time</th>
                <th>Avg HR</th>
                <th>Max HR</th>
                <th>Distance</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-6 opacity-70">Načítavam…</td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => {
                  const eff = toEffSport(r);
                  return (
                    <tr
                      key={r.activity_id}
                      className="cursor-pointer border-t border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setSelectedId(r.activity_id)}
                      title={r.name}
                    >
                      <td>{new Date(r.date).toLocaleDateString("sk-SK")}</td>
                      <td>{sportUiLabel(eff)}</td>
                      <td className="truncate max-w-[260px]">{r.name}</td>
                      <td>{r.moving_time_s != null ? `${Math.floor((r.moving_time_s || 0) / 60)} min` : "—"}</td>
                      <td>{r.average_heartrate_bpm ?? "—"}</td>
                      <td>{r.max_heartrate_bpm ?? "—"}</td>
                      <td>{r.distance_m != null ? `${((r.distance_m || 0) / 1000).toFixed(2)} km` : "—"}</td>
                    </tr>
                  );
                })}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan={7} className="py-6 opacity-70">
                    {start && end
                      ? "Žiadne aktivity v tomto období."
                      : "Klikni na týždeň v grafe, aby sa zobrazili aktivity."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL */}
      {selectedId != null && (
        <div className={SUBCARD}>
          <ActivityDetail activityId={selectedId} />
        </div>
      )}
    </div>
  );
}