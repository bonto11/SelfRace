"use client";

import { useEffect, useState } from "react";
import {
  listAppSubscriptionTiersAdmin,
  getAppSubscriptionStatusAdmin,
  setAppSubscriptionTierAdmin,
  cancelScheduledSubscriptionChangeAdmin,
} from "../actions";

type Tier = {
  code: string;
  name: string;
  monthly_price_cents: number;
};

type UserSubStatus = {
  tier_code: string;
  active_subscription: {
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  scheduled_change: {
    kind: "downgrade" | "cancel";
    to_tier_code: string | null;
    effective_from: string | null;
  } | null;
} | null;

type LiveState = {
  userId: number;
  loading: boolean;
  status: UserSubStatus;
  error: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("sk-SK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminSubscriptionAction({
  userIds,
  usersById,
}: {
  userIds: number[];
  usersById: Record<number, string>;
}) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string>("free");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [liveStates, setLiveStates] = useState<Record<number, LiveState>>({});

  useEffect(() => {
    listAppSubscriptionTiersAdmin()
      .then((items) => setTiers(items || []))
      .catch((e) => console.error("[AdminSubscription] load tiers error", e))
      .finally(() => setTiersLoading(false));
  }, []);

  async function refetchLive(ids: number[]) {
    for (const uid of ids) {
      setLiveStates((prev) => ({
        ...prev,
        [uid]: {
          userId: uid,
          loading: true,
          status: prev[uid]?.status ?? null,
          error: null,
        },
      }));
      try {
        const st = await getAppSubscriptionStatusAdmin(uid);
        setLiveStates((prev) => ({
          ...prev,
          [uid]: { userId: uid, loading: false, status: st, error: null },
        }));
      } catch (e: any) {
        setLiveStates((prev) => ({
          ...prev,
          [uid]: {
            userId: uid,
            loading: false,
            status: null,
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

  async function handleSave() {
    if (userIds.length === 0) return;
    const dateNote = customEndDate
      ? ` (vlastný dátum vypršania ${customEndDate} — BE to zatiaľ ignoruje, treba dorobiť)`
      : "";
    if (
      !confirm(
        `Nastaviť predplatné "${selectedTier}" pre ${userIds.length} používateľa/ov?${dateNote}`,
      )
    )
      return;

    setSaving(true);
    const failures: string[] = [];
    for (const uid of userIds) {
      try {
        await setAppSubscriptionTierAdmin(uid, selectedTier, {
          periodEndIso: customEndDate
            ? new Date(customEndDate).toISOString()
            : null,
          note: note || null,
        });
      } catch (e: any) {
        failures.push(`#${uid}: ${e.message}`);
      }
    }
    setSaving(false);

    if (failures.length) {
      alert(`⚠️ Niektoré zlyhali:\n${failures.join("\n")}`);
    } else {
      alert("✅ Predplatné nastavené.");
    }
    await refetchLive(userIds);
  }

  async function handleCancelScheduled() {
    if (userIds.length === 0) return;
    if (
      !confirm(
        `Zrušiť naplánovanú zmenu (downgrade/cancel) pre ${userIds.length} používateľa/ov?`,
      )
    )
      return;

    setSaving(true);
    const failures: string[] = [];
    for (const uid of userIds) {
      try {
        await cancelScheduledSubscriptionChangeAdmin(uid);
      } catch (e: any) {
        failures.push(`#${uid}: ${e.message}`);
      }
    }
    setSaving(false);

    if (failures.length) {
      alert(`⚠️ Niektoré zlyhali:\n${failures.join("\n")}`);
    } else {
      alert("✅ Naplánovaná zmena zrušená.");
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
                    <span className="text-purple-400 uppercase font-bold">
                      {s.status?.tier_code || "free"}
                    </span>
                  )}
                </div>
                {s && !s.loading && !s.error && s.status && (
                  <>
                    <div className="text-gray-500">
                      Obdobie:{" "}
                      <span className="text-gray-300">
                        {fmtDate(
                          s.status.active_subscription?.current_period_start ??
                            null,
                        )}{" "}
                        →{" "}
                        {fmtDate(
                          s.status.active_subscription?.current_period_end ??
                            null,
                        )}
                      </span>
                    </div>
                    {s.status.scheduled_change && (
                      <div className="text-amber-400">
                        Naplánované: {s.status.scheduled_change.kind}
                        {s.status.scheduled_change.to_tier_code
                          ? ` → ${s.status.scheduled_change.to_tier_code}`
                          : ""}{" "}
                        od{" "}
                        {fmtDate(s.status.scheduled_change.effective_from)}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Formulár - zmena tieru */}
      <div className="space-y-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
          Zmena predplatného
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Nový tier
            </span>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              disabled={tiersLoading}
              className="bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-purple-500 outline-none"
            >
              <option value="free">free</option>
              {tiers.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code} — {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Vlastný dátum vypršania{" "}
              <span className="text-amber-500 normal-case">
                (vyžaduje BE úpravu, zatiaľ sa ignoruje)
              </span>
            </span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-purple-500 outline-none"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
            Poznámka (support ticket, dôvod...)
          </span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="napr. support ticket #123 — kompenzácia za výpadok"
            className="bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-purple-500 outline-none"
          />
        </label>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || tiersLoading}
            className="bg-purple-600 hover:bg-purple-500 text-white font-black py-2.5 px-6 rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50"
          >
            {saving ? "Ukladám..." : "Nastaviť predplatné"}
          </button>
          <button
            onClick={handleCancelScheduled}
            disabled={saving}
            className="bg-amber-900/30 border border-amber-900/50 hover:bg-amber-900/50 text-amber-400 font-black py-2.5 px-6 rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50"
          >
            Zrušiť naplánovanú zmenu
          </button>
        </div>
      </div>
    </div>
  );
}