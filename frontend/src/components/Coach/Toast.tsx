"use client";
export default function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg">
      <div className="mb-1">{msg}</div>
      <button className="underline text-xs opacity-80" onClick={onClose}>OK</button>
    </div>
  );
}