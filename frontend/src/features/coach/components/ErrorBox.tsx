// src/features/coach/components/ErrorBox.tsx
"use client";

export default function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mt-4 bg-red-900/30 border border-red-600 text-red-200 p-3 rounded">
      <div className="font-semibold mb-0.5">AI error</div>
      <p className="text-sm opacity-90">{message}</p>
    </div>
  );
}