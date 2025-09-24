// src/shared/components/InfoMessage.tsx
"use client";
import React from "react";

export type InfoKind = "info" | "success" | "error";

export default function InfoMessage({
  text,
  kind = "info",
  onClose,
}: {
  text: string;
  kind?: InfoKind;
  onClose: () => void;
}) {
  const color =
    kind === "success" ? "bg-emerald-700" :
    kind === "error"   ? "bg-rose-700"    :
                         "bg-gray-900";

  return (
    <div className={`text-white text-sm px-4 py-3 rounded shadow-lg ${color}`}>
      <div className="mb-1">{text}</div>
      <button className="underline text-xs opacity-80" onClick={onClose}>
        OK
      </button>
    </div>
  );
}