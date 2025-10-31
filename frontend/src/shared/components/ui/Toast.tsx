// src/shared/components/ui/Toast.tsx
"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { cx } from "@/shared/ui";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; type: ToastType; text: string; ttl: number };

// ---- public hook ------------------------------------------------------------
const Ctx = React.createContext<{ show: (t: ToastType, text: string, ttl?: number) => void } | null>(null);

export function useToast() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("ToastHost missing");
  return ctx.show;
}

// ---- global singleton (event-bus) ------------------------------------------
const BUS = "up:toast";
type BusDetail = { type: ToastType; text: string; ttl?: number };
type BusEvent = CustomEvent<BusDetail>;

function emit(detail: BusDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<BusDetail>(BUS, { detail }));
}

/** Pohodlný API bez hooku (funguje z ľubovoľného client komponentu). */
export const toast = {
  success(text: string, ttl?: number) { emit({ type: "success", text, ttl }); },
  error(text: string, ttl?: number)   { emit({ type: "error", text, ttl }); },
  info(text: string, ttl?: number)    { emit({ type: "info", text, ttl }); },
};

// ---- host (renderer) --------------------------------------------------------
export default function ToastHost() {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const show = (type: ToastType, text: string, ttl = 2500) => {
    const id = Date.now() + Math.random();
    setItems(arr => [...arr, { id, type, text, ttl }]);
    window.setTimeout(() => setItems(arr => arr.filter(x => x.id !== id)), ttl);
  };

  // počúvaj globálny bus (pre singleton API)
  React.useEffect(() => {
    const onBus = (e: Event) => {
      const { type, text, ttl } = (e as BusEvent).detail;
      show(type, text, ttl);
    };
    window.addEventListener(BUS, onBus as EventListener);
    return () => window.removeEventListener(BUS, onBus as EventListener);
  }, []);

  const node = (
    <div className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center gap-2 p-3">
      <div className="mt-auto w-full max-w-sm space-y-2">
        {items.map(t => (
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