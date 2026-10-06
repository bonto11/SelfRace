"use client";

import { useEffect, useState } from "react";
import {
  clearWelcomeWeekAdmin,
  getWelcomeWeekAdminStatus,
  setWelcomeWeekAdmin,
} from "../actions";

type Win = { from: string; to: string; note?: string | null; meta_id?: number } | null;

type LiveState = {
  loading: boolean;
  active: boolean;
  notEligible: boolean;
  windows: { activities: Win; plan: Win; admin: Win };
  error: string | null;
};

const EMPTY_WINDOWS = { activities: null, plan: null, admin: null };

const WIN_LABEL: Record<keyof LiveState["windows"], string> = {
  activities: "Nový účet",
  plan: "Nový plán",
  admin: "Ručne (admin)",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric" });

export default function WelcomeWeekAction({
  userIds,
  usersById,
}: {
  userIds: number[];
  usersById: Record<number, string>;
}) {
  const [days, setDays] = useState(7);
  const [start, setStart] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [live, setLive] = useState<Record<number, LiveState>>({});

  async function refetchLive(ids: number[]) {
    for (const uid of ids) {
      setLive((prev) => ({
        ...prev,
        [uid]: { ...(prev[uid] ?? { active: false, notEligible: false, windows: EMPTY_WINDOWS, error: null }), loading: true },
      }));
      try {
        // čítanie stav aj vyhodnotí - okno aktívneho plánu sa zapíše do DB
        const st = await getWelcomeWeekAdminStatus(uid);
        setLive((prev) => ({
          ...prev,
          [uid]: {
            loading: false,
            active: !!st.active,
            notEligible: !!st.not_eligible,
            windows: st.windows ?? EMPTY_WINDOWS,
            error: null,
          },
        }));
      } catch (e: any) {
        setLive((prev) => ({
          ...prev,
          [uid]: { loading: false, active: false, notEligible: false, windows: EMPTY_WINDOWS, error: e.message || "Chyba" },
        }));
      }
    }
  }

  useEffect(() => {
    if (userIds.length === 0) {
      setLive({});
      return;
    }
    refetchLive(userIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIds.join(",")]);

  async function run(kind: "set" | "clear") {
    if (userIds.length === 0) return;
    const msg =
      kind === "set"
        ? `Zapnúť uvítací týždeň na ${days} dní pre ${userIds.length} používateľa/ov?`
        : `Zrušiť ručný uvítací týždeň pre ${userIds.length} používateľa/ov?`;
    if (!confirm(msg)) return;

    setSaving(true);
    const failures: string[] = [];
    for (const uid of userIds) {
      try {
        if (kind === "set") await setWelcomeWeekAdmin(uid, days, start || null, note);
        else await clearWelcomeWeekAdmin(uid);
      } catch (e: any) {
        failures.push(`#${uid}: ${e.message}`);
      }
    }
    setSaving(false);
    alert(failures.length ? `⚠️ Niektoré zlyhali:\n${failures.join("\n")}` : "✅ Hotovo.");
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
      <div className="space-y-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Live stav v DB</p>
        <div className="rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-hidden">
          {userIds.map((uid) => {
            const s = live[uid];
            return (
              <div key={uid} className="flex flex-col gap-1 px-3 py-2 bg-black/30 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">
                    #{uid} <span className="text-gray-500">{usersById[uid] || ""}</span>
                  </span>
                  {!s || s.loading ? (
                    <span className="text-gray-600 animate-pulse">načítavam...</span>
                  ) : s.error ? (
                    <span className="text-red-500">chyba: {s.error}</span>
                  ) : (
                    <span className={s.active ? "text-green-400 font-bold" : "text-gray-600"}>
                      {s.active ? "AKTÍVNY" : "neaktívny"}
                    </span>
                  )}
                </div>
                {s && !s.loading && !s.error && (
                  <div className="text-gray-500 space-y-0.5">
                    {(Object.keys(WIN_LABEL) as (keyof LiveState["windows"])[]).map((k) => {
                      const w = s.windows[k];
                      if (!w) return null;
                      return (
                        <div key={k}>
                          {WIN_LABEL[k]}: <span className="text-gray-300">{fmtDate(w.from)} – {fmtDate(w.to)}</span>
                          {w.note ? <span className="text-amber-400"> • {w.note}</span> : null}
                        </div>
                      );
                    })}
                    {s.notEligible && <div>Okno nového účtu: nespĺňa (účet starší ako 14 dní)</div>}
                    {!s.windows.activities && !s.windows.plan && !s.windows.admin && (
                      <div>Žiadne okno - nemá aktívny plán ani nový účet.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
          Zapnúť uvítací týždeň ručne
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Od (prázdne = dnes)</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Dní</span>
            <input
              type="number"
              min={1}
              max={60}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Poznámka</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="napr. kamoš začína"
              className="bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 outline-none"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => run("set")}
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 px-6 rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50"
          >
            {saving ? "Ukladám..." : "Zapnúť"}
          </button>
          <button
            onClick={() => run("clear")}
            disabled={saving}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2.5 px-6 rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50"
          >
            Zrušiť ručné okno
          </button>
        </div>
      </div>
    </div>
  );
}
