// src/shared/components/ui/Toast.tsx
"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { cx } from "@/shared/ui";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; type: ToastType; text: string; ttl: number };

const Ctx = React.createContext<{ show: (t: ToastType, text: string, ttl?: number) => void } | null>(null);

export function useToast() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("ToastHost missing");
  return ctx.show;
}

export default function ToastHost() {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const show = (type: ToastType, text: string, ttl = 2500) => {
    const id = Date.now() + Math.random();
    setItems((arr) => [...arr, { id, type, text, ttl }]);
    setTimeout(() => setItems((arr) => arr.filter((x) => x.id !== id)), ttl);
  };

  const node = (
    <div className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center gap-2 p-3">
      <div className="mt-auto w-full max-w-sm space-y-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto rounded-md px-3 py-2 shadow border",
              t.type === "success" && "bg-emerald-600 text-white border-emerald-700",
              t.type === "error" && "bg-red-600 text-white border-red-700",
              t.type === "info" && "bg-gray-800 text-white border-gray-700"
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Ctx.Provider value={{ show }}>
      {typeof document !== "undefined" ? createPortal(node, document.body) : null}
    </Ctx.Provider>
  );
}