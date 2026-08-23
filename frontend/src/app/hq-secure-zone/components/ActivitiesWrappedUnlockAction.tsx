"use client";

import { useEffect, useState } from "react";
import {
  getActivitiesWrappedAdminStatus,
  unlockActivitiesWrappedAdmin,
} from "../actions";

type TriggerInfo = {
  reason: string;
  trigger_label: string | null;
  trigger_date: string | null;
  expires_at: string;
} | null;

type LiveState = {
  userId: number;
  loading: boolean;
  isActive: boolean;
  activeTrigger: TriggerInfo;
  latestTrigger: TriggerInfo;
  error: string | null;
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("sk-SK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ActivitiesWrappedUnlockAction({
  userIds,
  usersById,
}: {
  userIds: number[];
  usersById: Record<number, string>;
}) {
  const [label, setLabel] = useState<string>("");
  const [validDays, setValidDays] = useState<number>(14);
  const [saving, setSaving] = useState(false);
  const [liveStates, setLiveStates] = useState<Record<number, LiveState>>({});

  async function refetchLive(ids: number[]) {
    for (const uid of ids) {
      setLiveStates((prev) => ({
        ...prev,
        [uid]: {
          userId: uid,
          loading: true,
          isActive: prev[uid]?.isActive ?? false,
          activeTrigger: prev[uid]?.activeTrigger ?? null,
          latestTrigger: prev[uid]?.latestTrigger ?? null,
          error: null,
        },
      }));
      try {
        const st = await getActivitiesWrappedAdminStatus(uid);
        setLiveStates((prev) => ({
          ...prev,
          [uid]: {
            userId: uid,
            loading: false,
            isActive: !!st.is_active,
            activeTrigger: st.active_trigger ?? null,
            latestTrigger: st.latest_trigger ?? null,
            error: null,
          },
        }));
      } catch (e: any) {
        setLiveStates((prev) => ({
          ...prev,
          [uid]: {
            userId: uid,
            loading: false,
            isActive: false,
            activeTrigger: null,
            latestTrigger: null,
            error: e.message || "Chyba",
          },
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

  async function handleUnlock() {
    if (userIds.length === 0) return;
    if (
      !confirm(
        `Odomknúť "Activities Wrapped" na ${validDays} dní pre ${userIds.length} používateľa/ov?`,
      )
    )
      return;

    setSaving(true);
    const failures: string[] = [];
    for (const uid of userIds) {
      try {
        await unlockActivitiesWrappedAdmin(uid, label, validDays);
      } catch (e: any) {
        failures.push(`#${uid}: ${e.message}`);
      }
    }
    setSaving(false);

    if (failures.length) {
      alert(`⚠️ Niektoré zlyhali:\n${failures.join("\n")}`);
    } else {
      alert("✅ Odomknuté.");
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
      {/* LIVE stav */}
      <div className="space-y-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
          Live stav v DB
        </p>
        <div className="rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-hidden">
          {userIds.map((uid) => {
            const s = liveStates[uid];
            return (
              <div
                key={uid}
                className="flex flex-col gap-1 px-3 py-2 bg-black/30 text-xs font-mono"
              >
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">
                    #{uid}{" "}
                    <span className="text-gray-500">{usersById[uid] || ""}</span>
                  </span>
                  {!s || s.loading ? (
                    <span className="text-gray-600 animate-pulse">
                      načítavam...
                    </span>
                  ) : s.error ? (
                    <span className="text-red-500">chyba: {s.error}</span>
                  ) : (
                    <span
                      className={
                        s.isActive
                          ? "text-green-400 font-bold"
                          : "text-gray-600"
                      }
                    >
                      {s.isActive ? "AKTÍVNY POPUP" : "žiadny aktívny"}
                    </span>
                  )}
                </div>
                {s && !s.loading && !s.error && s.activeTrigger && (
                  <div className="text-gray-500">
                    Dôvod:{" "}
                    <span className="text-amber-400">
                      {s.activeTrigger.reason}
                    </span>
                    {s.activeTrigger.trigger_label
                      ? ` • "${s.activeTrigger.trigger_label}"`
                      : ""}
                    {" • platí do "}
                    <span className="text-gray-300">
                      {fmtDateTime(s.activeTrigger.expires_at)}
                    </span>
                  </div>
                )}
                {s && !s.loading && !s.error && !s.activeTrigger && s.latestTrigger && (
                  <div className="text-gray-600">
                    Posledný (vypršaný): {s.latestTrigger.trigger_label || "—"}{" "}
                    • vypršal {fmtDateTime(s.latestTrigger.expires_at)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Formulár */}
      <div className="space-y-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
          Odomknúť Activities Wrapped popup
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Popis / dôvod (voliteľné)
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="napr. support ticket #123"
              className="bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Platnosť (dní)
            </span>
            <input
              type="number"
              min={1}
              max={365}
              value={validDays}
              onChange={(e) => setValidDays(Number(e.target.value))}
              className="bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 outline-none"
            />
          </label>
        </div>

        <button
          onClick={handleUnlock}
          disabled={saving}
          className="bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 px-6 rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50"
        >
          {saving ? "Odomykám..." : "Odomknúť popup"}
        </button>
      </div>
    </div>
  );
}