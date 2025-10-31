// src/shared/components/ui/Toast.tsx
"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { cx } from "@/shared/ui";

type ToastType = "success" | "error" | "info";
type Phase = "in" | "hold" | "out";
type ToastItem = { id: number; type: ToastType; text: string; ttl: number; phase: Phase };

// ---- public hook (optional) -------------------------------------------------
const Ctx = React.createContext<{ show: (t: ToastType, text: string, ttl?: number) => void } | null>(null);
export function useToast() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("ToastHost missing");
  return ctx.show;
}

// ---- global singleton (event bus) -------------------------------------------
const BUS = "up:toast";
type BusDetail = { type: ToastType; text: string; ttl?: number };
type BusEvent = CustomEvent<BusDetail>;
function emit(detail: BusDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<BusDetail>(BUS, { detail }));
}
export const toast = {
  success(text: string, ttl?: number) { emit({ type: "success", text, ttl }); },
  error(text: string, ttl?: number)   { emit({ type: "error", text, ttl }); },
  info(text: string, ttl?: number)    { emit({ type: "info", text, ttl }); },
};

// ---- host (renderer) --------------------------------------------------------
export default function ToastHost() {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const show = (type: ToastType, text: string, ttl = 2800) => {
    const id = Date.now() + Math.random();
    // 1) mount v stave "in"
    setItems(arr => [...arr, { id, type, text, ttl, phase: "in" }]);

    // 2) po vstupe smoothe prepneme do "hold"
    window.setTimeout(() => {
      setItems(arr => arr.map(x => x.id === id ? { ...x, phase: "hold" } : x));
    }, 20);

    // 3) ~300ms pred koncom spustíme "out"
    const outAt = Math.max(600, ttl - 360);
    window.setTimeout(() => {
      setItems(arr => arr.map(x => x.id === id ? { ...x, phase: "out" } : x));
    }, outAt);

    // 4) po dobe TTL odmount
    window.setTimeout(() => {
      setItems(arr => arr.filter(x => x.id !== id));
    }, ttl);
  };

  // počúvaj globálny bus
  React.useEffect(() => {
    const onBus = (e: Event) => {
      const { type, text, ttl } = (e as BusEvent).detail;
      show(type, text, ttl);
    };
    window.addEventListener(BUS, onBus as EventListener);
    return () => window.removeEventListener(BUS, onBus as EventListener);
  }, []);

  const node = (
    <div
      className={cx(
        // celá overlay vrstva
        "pointer-events-none fixed inset-0 z-[60]",
        // kontajner pri vrchu: ~pod headerom, centrovaný
        "flex justify-center pt-[12vh]" // cca výška 8/10 zhora ako si chcel
      )}
    >
      <div className="w-full flex flex-col items-center gap-2">
        {items.map(t => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto select-none",
              // šírka: mobil ~full - 24px; desktop fixná kapsula
              "w-[calc(100vw-24px)] sm:w-[520px]",
              // vizuál „iOS pill“
              "rounded-[22px] sm:rounded-[22px] px-4 py-3",
              "backdrop-blur-md shadow-lg border",
              // farby podľa typu
              t.type === "success" && "bg-emerald-600/95 text-white border-emerald-500/50",
              t.type === "error" && "bg-red-600/95 text-white border-red-500/50",
              t.type === "info" && "bg-neutral-800/95 text-white border-neutral-700/60",
              // typografia
              "text-[15px] leading-snug font-medium",
              // animácia: sprava -> stred -> doprava
              t.phase === "in"   && "toast-enter",
              t.phase === "hold" && "toast-hold",
              t.phase === "out"  && "toast-exit"
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

/**
 * Potrebné globálne CSS (pridaj raz do globals.css).
 * Mierne spomalené pre plynulý „slide“ (300ms).
 */
/*
.toast-enter {
  transform: translateX(28vw);
  opacity: 0.0;
  transition: transform 320ms cubic-bezier(.22,.61,.36,1), opacity 320ms ease;
}
.toast-hold {
  transform: translateX(0);
  opacity: 1;
  transition: transform 220ms ease-out, opacity 220ms ease-out;
}
.toast-exit {
  transform: translateX(28vw);
  opacity: 0;
  transition: transform 340ms cubic-bezier(.4,.0,.2,1), opacity 260ms ease;
}
@media (min-width: 640px) { /* desktop – kratšia dráha */
  .toast-enter { transform: translateX(340px); }
  .toast-exit  { transform: translateX(340px); }
}
*/