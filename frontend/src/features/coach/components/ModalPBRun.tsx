"use client";

import { useState } from "react";
import {
  RUN_DISTANCES_M,
  distanceLabel,
  saveBest,
  type UserBest,
} from "@/shared/api/bests";
import { maskHHMMSS, hhmmssToSec, secToHHMMSS } from "@/shared/utils/time";
import type { PBRun } from "@/features/coach/types/prefsTypes";

// ---- adapters (PBRun <-> UserBest) -----------------------------------------
const kmToM = (km: number) => Math.round(km * 1000);
const mToKm = (m: number) => +(m / 1000).toFixed(1);

function toPBRun(b: UserBest): PBRun {
  return {
    distanceKm: mToKm(b.distance_m),
    best: b.time_str ?? (b.best_time_s != null ? secToHHMMSS(b.best_time_s) ?? "" : ""),
    activityId: b.activity_id ?? null,
    date: b.achieved_at ?? null,
  };
}

function toUserBest(r: EditRow): UserBest {
  const timeSec = hhmmssToSec(r.time_str);
  return {
    distance_m: r.distance_m,
    best_time_s: timeSec ?? undefined,
    time_str: timeSec == null ? r.time_str : undefined,
    activity_id: r.activity_id.trim() ? Number(r.activity_id) : null,
    achieved_at: r.achieved_at || null,
  };
}

// ---- UI-friendly riadok (stringy) ------------------------------------------
type EditRow = {
  distance_m: number;
  time_str: string;    // "hh:mm:ss"
  activity_id: string; // text -> pri save Number()
  achieved_at: string; // "YYYY-MM-DD"
};

type Props = {
  userId: number;
  /** voliteľne ak chceš predvyplniť (PBRun – nový typ) */
  initialPB?: PBRun[];
  /** alebo starý formát (ak máš z API) */
  initialUserBest?: UserBest[];
  onClose: () => void;
  onSaved?: (b: PBRun) => void; // vraciam PBRun
};

export default function ModalPBRun({
  userId,
  initialPB = [],
  initialUserBest = [],
  onClose,
  onSaved,
}: Props) {
  // zdroj dát: preferuj PBRun, inak UserBest
  const seedUserBest: UserBest[] =
    initialPB.length
      ? RUN_DISTANCES_M.map((m) => {
          const hit = initialPB.find((p) => kmToM(p.distanceKm) === m);
          return {
            distance_m: m,
            best_time_s: hit?.best ? hhmmssToSec(hit.best) ?? undefined : undefined,
            time_str: hit?.best ?? undefined,
            activity_id: hit?.activityId ?? null,
            achieved_at: hit?.date ?? null,
          };
        })
      : initialUserBest;

  const [rows, setRows] = useState<EditRow[]>(() =>
    RUN_DISTANCES_M.map((m) => {
      const found = seedUserBest.find((x) => x.distance_m === m);
      return {
        distance_m: m,
        time_str: found?.time_str ?? (secToHHMMSS(found?.best_time_s ?? null) ?? ""),
        activity_id: found?.activity_id != null ? String(found.activity_id) : "",
        achieved_at: found?.achieved_at ?? "",
      };
    })
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setField = (idx: number, key: keyof EditRow, val: string) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));

  const handleTimeInput = (idx: number, raw: string) =>
    setField(idx, "time_str", maskHHMMSS(raw));

  async function onSaveAll() {
    setSaving(true);
    setErr(null);
    try {
      for (const r of rows) {
        const timeSec = hhmmssToSec(r.time_str);
        if (!timeSec && !r.time_str.trim()) continue; // prázdne -> skip

        await saveBest(userId, {
          distance_m: r.distance_m,
          time_str: timeSec == null ? r.time_str : undefined,
          ...(timeSec != null ? { time_sec: timeSec } : {}),
          activity_id: r.activity_id.trim() ? Number(r.activity_id) : undefined,
          achieved_at: r.achieved_at || undefined,
        });

        onSaved?.(
          toPBRun(
            toUserBest({
              distance_m: r.distance_m,
              time_str: r.time_str,
              activity_id: r.activity_id,
              achieved_at: r.achieved_at,
            })
          )
        );
      }
      onClose();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal">
      <div className="modal-body">
        <h3>Upraviť Personal Bests — Running</h3>
        {err && <div className="error">{err}</div>}

        <div className="grid">
          {rows.map((r, idx) => (
            <div key={r.distance_m} className="row">
              <div className="col label">{distanceLabel(r.distance_m, "run")}</div>

              <div className="col">
                <input
                  placeholder="hh:mm:ss"
                  value={r.time_str}
                  onChange={(e) => handleTimeInput(idx, e.target.value)}
                  inputMode="numeric"
                />
              </div>

              <div className="col">
                <input
                  placeholder="Activity ID (optional)"
                  value={r.activity_id}
                  onChange={(e) => setField(idx, "activity_id", e.target.value)}
                />
              </div>

              <div className="col">
                <input
                  type="date"
                  value={r.achieved_at}
                  onChange={(e) => setField(idx, "achieved_at", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="actions">
          <button onClick={onClose} disabled={saving}>Cancel</button>
          <button onClick={onSaveAll} disabled={saving}>Save</button>
        </div>
      </div>

      <style jsx>{`
        .grid {
          display: grid;
          grid-template-columns: 170px 140px 160px 170px;
          gap: 12px;
          align-items: center;
        }
        .row { display: contents; }
        .label { font-weight: 600; }
        .actions { margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end; }
        input { width: 100%; background: #0f172a; border: 1px solid #374151; padding: 6px 8px; border-radius: 6px; color: #fff; }
        .error { color: #f55; margin-bottom: 8px; }
      `}</style>
    </div>
  );
}