// src/shared/components/InfoMessage.tsx
"use client";

export default function InfoMessage({
  kind = "info",
  text,
  onClose,
}: {
  kind?: "info" | "success" | "error";
  text: string;
  onClose: () => void;
}) {
  const bg =
    kind === "success"
      ? "bg-emerald-700"
      : kind === "error"
      ? "bg-rose-700"
      : "bg-gray-800";

  return (
    <div className={`fixed top-4 right-4 z-50 text-sm text-white px-4 py-3 rounded shadow-lg ${bg}`}>
      <div className="mb-1">{text}</div>
      <button className="underline text-xs opacity-90 hover:opacity-100" onClick={onClose}>
        OK
      </button>
    </div>
  );
}