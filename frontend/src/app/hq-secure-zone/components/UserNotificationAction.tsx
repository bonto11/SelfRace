"use client";

import { useState } from "react";
import { sendUserNotification } from "../actions";

export default function UserNotificationAction({
  userIds,
  usersById,
}: {
  userIds: number[];
  usersById: Record<number, string>;
}) {
  const [titleSk, setTitleSk] = useState("");
  const [bodySk, setBodySk] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [url, setUrl] = useState("/activities");
  const [sending, setSending] = useState(false);

  const canSend = userIds.length > 0 && titleSk.trim() && bodySk.trim();

  async function handleSend() {
    if (!canSend) return;
    if (
      !confirm(
        `Poslať notifikáciu ${userIds.length} používateľovi/om?\n\n${userIds
          .map((id) => `#${id} ${usersById[id] || ""}`)
          .join("\n")}`,
      )
    )
      return;

    setSending(true);
    try {
      const payload = {
        messages: {
          sk: { title: titleSk, body: bodySk, url },
          en: { title: titleEn || titleSk, body: bodyEn || bodySk, url },
        },
      };
      await sendUserNotification(userIds, payload);
      alert("🚀 Notifikácia odoslaná.");
      setTitleSk("");
      setBodySk("");
      setTitleEn("");
      setBodyEn("");
    } catch (e: any) {
      alert("❌ Chyba: " + e.message);
    } finally {
      setSending(false);
    }
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
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
          Príjemcovia ({userIds.length})
        </p>
        <div className="rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-hidden max-h-32 overflow-y-auto bg-black/30">
          {userIds.map((uid) => (
            <div key={uid} className="px-3 py-1.5 text-xs font-mono text-gray-300">
              #{uid} <span className="text-gray-500">{usersById[uid] || ""}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-4 bg-blue-900/10 rounded-xl border border-blue-900/20">
        <p className="text-[10px] font-black uppercase text-blue-400">Slovenčina</p>
        <input
          value={titleSk}
          onChange={(e) => setTitleSk(e.target.value)}
          className="w-full bg-black border border-gray-800 p-3 rounded-lg text-white outline-none"
          placeholder="Titulok..."
        />
        <textarea
          value={bodySk}
          onChange={(e) => setBodySk(e.target.value)}
          className="w-full bg-black border border-gray-800 p-3 rounded-lg text-sm text-gray-400 outline-none"
          placeholder="Obsah správy..."
          rows={2}
        />
      </div>

      <div className="space-y-3 p-4 bg-purple-900/10 rounded-xl border border-purple-900/20">
        <p className="text-[10px] font-black uppercase text-purple-400">
          English <span className="text-gray-600 normal-case font-normal">(nepovinné, fallback na SK)</span>
        </p>
        <input
          value={titleEn}
          onChange={(e) => setTitleEn(e.target.value)}
          className="w-full bg-black border border-gray-800 p-3 rounded-lg text-white outline-none"
          placeholder="Title..."
        />
        <textarea
          value={bodyEn}
          onChange={(e) => setBodyEn(e.target.value)}
          className="w-full bg-black border border-gray-800 p-3 rounded-lg text-sm text-gray-400 outline-none"
          placeholder="Body content..."
          rows={2}
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
          URL po kliknutí
        </span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-blue-500 outline-none"
          placeholder="/activities"
        />
      </label>

      <button
        onClick={handleSend}
        disabled={sending || !canSend}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl uppercase tracking-widest transition-all disabled:opacity-30 shadow-lg shadow-blue-500/20"
      >
        {sending ? "Odosielam..." : `Poslať ${userIds.length} používateľovi/om`}
      </button>
    </div>
  );
}
