"use client";

import { useEffect, useMemo, useState } from "react";
import { listUsersLite } from "../actions";

type UserLite = { id: number; email: string };

import StravaOverrideAction from "./StravaOverrideAction";
import UserNotificationAction from "./UserNotificationAction";

type ActionKey = "strava_import_override" | "send_notification";

const ACTIONS: { value: ActionKey; label: string }[] = [
  { value: "strava_import_override", label: "Strava — okno importu (override)" },
  { value: "send_notification", label: "Notifikácia — vybraným používateľom" },
];


export default function UserInterventionsPanel() {
  const [isOpen, setIsOpen] = useState(false);

  const [users, setUsers] = useState<UserLite[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [actionType, setActionType] = useState<ActionKey>("strava_import_override");

  useEffect(() => {
    if (!isOpen || users.length > 0) return;
    setUsersLoading(true);
    listUsersLite()
      .then(setUsers)
      .catch((e) => console.error("[UserInterventions] load users error", e))
      .finally(() => setUsersLoading(false));
  }, [isOpen, users.length]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => String(u.id).includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  const usersById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const u of users) map[u.id] = u.email;
    return map;
  }, [users]);

  function toggleUser(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredUsers.forEach((u) => next.add(u.id));
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const selectedIdsArr = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return (
    <div className="bg-gray-900 border-t-4 border-amber-500 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      {/* HLAVIČKA */}
      <div
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-white uppercase italic">
            <span className="text-amber-500 mr-3">🛠️</span> Zásahy do používateľov
          </h2>
          {!isOpen && selectedIds.size > 0 && (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-amber-900/30 text-amber-400">
              {selectedIds.size} vybraných
            </span>
          )}
        </div>
        <div className={`text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : "rotate-0"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {/* ROZBALENÝ OBSAH */}
      <div className={`transition-all duration-500 ease-in-out ${isOpen ? "max-h-[3000px] opacity-100 border-t border-gray-800" : "max-h-0 opacity-0 overflow-hidden"}`}>
        <div className="p-6 md:p-8 space-y-8">
          {/* 1. VÝBER POUŽÍVATEĽOV */}
          <div className="space-y-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              1. Vyber používateľa/ov
            </p>

            <div className="flex gap-2 flex-wrap items-center">
              <input
                type="text"
                placeholder="Hľadať podľa ID alebo emailu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[200px] bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 outline-none"
              />
              <button
                onClick={selectAllFiltered}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
              >
                Vybrať zobrazených
              </button>
              <button
                onClick={clearSelection}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
              >
                Zrušiť výber
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-800 divide-y divide-gray-800 bg-black/30">
              {usersLoading ? (
                <div className="text-center text-gray-600 text-xs py-6 animate-pulse">Načítavam používateľov...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center text-gray-600 text-xs py-6">Žiadni používatelia.</div>
              ) : (
                filteredUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-800/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="accent-amber-500"
                    />
                    <span className="text-xs font-mono text-gray-300">
                      #{u.id} <span className="text-gray-500">{u.email}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* 2. VÝBER AKCIE */}
          <div className="space-y-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              2. Vyber akciu
            </p>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ActionKey)}
              className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white font-bold focus:border-amber-500 outline-none"
            >
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* 3. AKČNÝ FORMULÁR PRE ZVOLENÚ AKCIU */}
          <div className="space-y-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              3. Detaily a uloženie
            </p>
            {actionType === "strava_import_override" && (
              <StravaOverrideAction userIds={selectedIdsArr} usersById={usersById} />
            )}
            {actionType === "send_notification" && (
              <UserNotificationAction userIds={selectedIdsArr} usersById={usersById} />
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
