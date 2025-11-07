"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { cx } from "@/shared/ui";
import {
  TOAST_LAYER,
  TOAST_STACK,
  TOAST_PILL_BASE,
  TOAST_SUCCESS,
  TOAST_ERROR,
  TOAST_INFO,
} from "@/shared/ui/classes";

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
    setItems(arr => [...arr, { id, type, text, ttl, phase: "in" }]);
    window.setTimeout(() => {
      setItems(arr => arr.map(x => x.id === id ? { ...x, phase: "hold" } : x));
    }, 20);
    const outAt = Math.max(600, ttl - 360);
    window.setTimeout(() => {
      setItems(arr => arr.map(x => x.id === id ? { ...x, phase: "out" } : x));
    }, outAt);
    window.setTimeout(() => {
      setItems(arr => arr.filter(x => x.id !== id));
    }, ttl);
  };

  React.useEffect(() => {
    const onBus = (e: Event) => {
      const { type, text, ttl } = (e as BusEvent).detail;
      show(type, text, ttl);
    };
    window.addEventListener(BUS, onBus as EventListener);
    return () => window.removeEventListener(BUS, onBus as EventListener);
  }, []);

  const node = (
    <div className={TOAST_LAYER}>
      <div className={TOAST_STACK}>
        {items.map(t => (
          <div
            key={t.id}
            className={cx(
              TOAST_PILL_BASE,
              t.type === "success" && TOAST_SUCCESS,
              t.type === "error" && TOAST_ERROR,
              t.type === "info" && TOAST_INFO,
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