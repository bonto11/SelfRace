"use client";

import { useEffect, useState } from "react";
import {
  getStravaOverride,
  setStravaOverride,
  clearStravaOverride,
} from "../actions";

type LiveOverride = {
  days: number;
  note: string | null;
  granted_at: string | null;
} | null;

type UserLiveState = {
  userId: number;
  loading: boolean;
  override: LiveOverride;
  error: string | null;
};

export default function StravaOverrideAction({
  userIds,
  usersById,
}: {
  userIds: number[];
  usersById: Record<number, string>;
}) {
  const [days, setDays] = useState<number>(100);
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [liveStates, setLiveStates] = useState<Record<number, UserLiveState>>({});

  async function refetchLive(ids: number[]) {
    for (const uid of ids) {
      setLiveStates((prev) => ({
        ...prev,
        [uid]: { userId: uid, loading: true, override: prev[uid]?.override ?? null, error: null },
      }));
      try {
        const ov = await getStravaOverride(uid);
        setLiveStates((prev) => ({
          ...prev,
          [uid]: { userId: uid, loading: false, override: ov, error: null },
        }));
      } catch (e: any) {
        setLiveStates((prev) => ({
          ...prev,
          [uid]: { userId: uid, loading: false, override: null, error: e.message || "Chyba" },
        }));
      }
    }
  }

  useEffect(() => {
    if (userIds.length === 0) {
      setLiveStates({});
      return;
    }
    refetchLive(userIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIds.join(",")]);

  async function handleSave() {
    if (userIds.length === 0) return;
    if (!confirm(`Nastaviť override okna importu na ${days} dní pre ${userIds.length} používateľa/ov?`)) return;

    setSaving(true);
    const failures: string[] = [];
    for (const uid of userIds) {
      try {
        await setStravaOverride(uid, days, note);
      } catch (e: any) {
        failures.push(`#${uid}: ${e.message}`);
      }
    }
    setSaving(false);

    if (failures.length) {
      alert(`⚠️ Niektoré zlyhali:\n${failures.join("\n")}`);
    } else {
      alert("✅ Override nastavený.");
    }
    await refetchLive(userIds);
  }

  async function handleClear() {
    if (userIds.length === 0) return;
    if (!confirm(`Vymazať override pre ${userIds.length} používateľa/ov?`)) return;

    setSaving(true);
    const failures: string[] = [];
    for (const uid of userIds) {
      try {
        await clearStravaOverride(uid);
      } catch (e: any) {
        failures.push(`#${uid}: ${e.message}`);
      }
    }
    setSaving(false);

    if (failures.length) {
      alert(`⚠️ Niektoré zlyhali:\n${failures.join("\n")}`);
    } else {
      alert("✅ Override vymazaný.");
    }
    await refetchLive(userIds);
  }

  if (userIds.length === 0) {
    return (
      <div className="text-center text-gray-600 text-xs font-bold uppercase tracking-widest py-6 border border-dashed border-gray-800 rounded-xl">
        Vyber aspoň jedného používateľa vyššie.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* LIVE stav pre každého vybraného usera */}
      <div className="space-y-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
          Live stav v DB
        </p>
        <div className="rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-hidden">
          {userIds.map((uid) => {
            const s = liveStates[uid];
            return (
              <div key={uid} className="flex justify-between items-center px-3 py-2 bg-black/30 text-xs font-mono">
                <span className="text-gray-300">
                  #{uid} <span className="text-gray-500">{usersById[uid] || ""}</span>
                </span>
                {!s || s.loading ? (
                  <span className="text-gray-600 animate-pulse">načítavam...</span>
                ) : s.error ? (
                  <span className="text-red-500">chyba: {s.error}</span>
                ) : s.override ? (
                  <span className="text-amber-400">
                    {s.override.days} dní{s.override.note ? ` • "${s.override.note}"` : ""}
                  </span>
                ) : (
                  <span className="text-gray-600">žiadny override</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Formulár */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
            Počet dní okna importu
          </span>
          <input
            type="number"
            min={1}
            max={3650}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
            Poznámka (support ticket, dôvod...)
          </span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="napr. support ticket #123"
            className="bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 outline-none"
          />
        </label>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 px-6 rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50"
        >
          {saving ? "Ukladám..." : "Uložiť override"}
        </button>
        <button
          onClick={handleClear}
          disabled={saving}
          className="bg-red-900/30 border border-red-900/50 hover:bg-red-900/50 text-red-400 font-black py-2.5 px-6 rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50"
        >
          Vymazať override
        </button>
      </div>
    </div>
  );
}
