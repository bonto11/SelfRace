"use client";

import { useState } from "react";
import { sendCoachFeedback } from "@/lib/coachApi";

type Props = {
  userId: number | null | undefined;
  weeks: number;
  goal: string;
  result: any;
  onSaved?: () => void;
  onError?: (msg: string) => void;
};

export default function Feedback({ userId, weeks, goal, result, onSaved, onError }: Props) {
  const [text, setText] = useState("");

  async function handleSend() {
    if (!userId || !text.trim()) return;
    try {
      const payload = {
        text: text.trim(),
        weeks,
        goal,
        model: result?.model,
        context: result?.context_used,
      };
      const json = await sendCoachFeedback(userId, payload);
      if (!json.success) throw new Error(json.detail || "Unknown error");
      setText("");
      onSaved?.();
    } catch (e:any) {
      onError?.(e.message || String(e));
    }
  }

  return (
    <div className="mt-6 bg-gray-800 p-4 rounded">
      <h3 className="font-semibold mb-2">Your comment to coach</h3>
      <textarea
        className="w-full bg-gray-900 border border-gray-700 rounded p-2 h-24"
        placeholder="Napíš čo sedí/nesedí, kedy máš preteky, kedy dovolenku…"
        value={text}
        onChange={e=>setText(e.target.value)}
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={handleSend}
          disabled={!userId || !text.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}