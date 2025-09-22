"use client";

import { useState, useMemo } from "react";

type Bests = {
  "5k"?: string | null;
  "10k"?: string | null;
  half?: string | null;
  marathon?: string | null;
  // voliteľné metadata:
  "5k_event"?: string | null;
  "10k_event"?: string | null;
  half_event?: string | null;
  marathon_event?: string | null;
  "5k_date"?: string | null;
  "10k_date"?: string | null;
  half_date?: string | null;
  marathon_date?: string | null;
};

export default function BestsEditor({
  value,
  onChange,
}: {
  value?: Bests;
  onChange?: (b: Bests) => void;
}) {
  const [open, setOpen] = useState(false);
  const v = useMemo<Bests>(() => value ?? {}, [value]);

  const row = (label: string, key: keyof Bests) => (
    <div className="flex items-center justify-between py-1">
      <span className="opacity-80 w-24">{label}</span>
      <span className="font-mono bg-black/30 px-2 py-0.5 rounded min-w-[96px] text-center">
        {v[key] || "—"}
      </span>
    </div>
  );

  return (
    <div className="bg-gray-800/80 border border-gray-700 rounded p-3 relative">
      {/* READ-ONLY RAD */}
      <div className="flex items-start gap-6">
        <div>
          <h3 className="font-semibold mb-1">Personal Bests</h3>
          <div className="text-sm">
            {row("5k", "5k")}
            {row("10k", "10k")}
            {row("Half", "half")}
            {row("Mar", "marathon")}
          </div>
        </div>
        <button
          type="button"
          className="ml-auto text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded inline-flex items-center gap-1"
          onClick={() => setOpen(true)}
          aria-label="Edit PBs"
          title="Editovať PBs"
        >
          ⚙️ <span>Edit</span>
        </button>
      </div>

      {/* EDIT OVERLAY */}
      {open && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 rounded">
          <div className="bg-gray-900 border border-gray-700 rounded p-3 w-full max-w-xl">
            <h4 className="font-semibold mb-2">Upraviť Personal Bests</h4>

            {(["5k", "10k", "half", "marathon"] as const).map((k) => (
              <div key={k} className="grid grid-cols-3 gap-2 mb-2">
                <label className="self-center capitalize">{k}</label>
                <input
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 font-mono"
                  placeholder="hh:mm:ss"
                  defaultValue={v[k] ?? ""}
                  onChange={(e) => (v[k] = e.target.value || null)}
                />
                <input
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1"
                  placeholder="Event (optional)"
                  defaultValue={v[`${k}_event` as keyof Bests] ?? ""}
                  onChange={(e) => (v[`${k}_event` as keyof Bests] = e.target.value || null)}
                />
                <div className="col-span-3">
                  <input
                    className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1"
                    placeholder="mm/dd/yyyy (optional)"
                    defaultValue={v[`${k}_date` as keyof Bests] ?? ""}
                    onChange={(e) => (v[`${k}_date` as keyof Bests] = e.target.value || null)}
                  />
                </div>
              </div>
            ))}

            <div className="mt-3 flex gap-2">
              <button
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded"
                onClick={() => {
                  onChange?.({ ...v });
                  setOpen(false);
                }}
              >
                Save
              </button>
              <button
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}