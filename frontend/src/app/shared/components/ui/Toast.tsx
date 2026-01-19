// shared/components/ui/Toast
"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { cx } from "@/app/shared/ui";
import {
  TOAST_LAYER,
  TOAST_STACK,
  TOAST_PILL_BASE,
  TOAST_SUCCESS,
  TOAST_ERROR,
  TOAST_INFO,
} from "@/app/shared/ui/classes";

type ToastType = "success" | "error" | "info";
type Phase = "in" | "hold" | "out";
type ToastItem = {
  id: number;
  type: ToastType;
  text: string;
  ttl: number; // ms, Infinity/<=0 = sticky
  phase: Phase;
};

// ---- public hook (optional) -------------------------------------------------
const Ctx = React.createContext<{
  show: (t: ToastType, text: string, ttl?: number) => void;
} | null>(null);
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

// sensible defaults (your old 2800ms was too short)
const TTL_SUCCESS = 3500;
const TTL_INFO = 4500;
const TTL_ERROR = 8000;

export const toast = {
  success(text: string, ttl: number = TTL_SUCCESS) {
    emit({ type: "success", text, ttl });
  },
  error(text: string, ttl: number = TTL_ERROR) {
    emit({ type: "error", text, ttl });
  },
  info(text: string, ttl: number = TTL_INFO) {
    emit({ type: "info", text, ttl });
  },
};

// ---- host (renderer) --------------------------------------------------------
export default function ToastHost() {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const lastShownRef = React.useRef<Record<string, number>>({}); // <-- ADD

  const dismiss = React.useCallback((id: number) => {
    setItems((arr) =>
      arr.map((x) => (x.id === id ? { ...x, phase: "out" } : x))
    );
    window.setTimeout(() => {
      setItems((arr) => arr.filter((x) => x.id !== id));
    }, 360);
  }, []);

  const show = React.useCallback(
    (type: ToastType, text: string, ttl: number = 2800) => {
      // ---- DEDUPE (prevents double toasts in dev/strict-mode etc.) ----
      const key = `${type}:${text}`;
      const now = Date.now();
      const last = lastShownRef.current[key] ?? 0;
      if (now - last < 1200) return; // ignore duplicates within 1.2s
      lastShownRef.current[key] = now;
      // ---------------------------------------------------------------

      const id = Date.now() + Math.random();
      const isSticky = ttl === Infinity || ttl <= 0;

      setItems((arr) => [...arr, { id, type, text, ttl, phase: "in" }]);

      window.setTimeout(() => {
        setItems((arr) =>
          arr.map((x) => (x.id === id ? { ...x, phase: "hold" } : x))
        );
      }, 20);

      if (isSticky) return;

      const outAt = Math.max(600, ttl - 360);
      window.setTimeout(() => {
        setItems((arr) =>
          arr.map((x) => (x.id === id ? { ...x, phase: "out" } : x))
        );
      }, outAt);

      window.setTimeout(() => {
        setItems((arr) => arr.filter((x) => x.id !== id));
      }, ttl);
    },
    []
  );

  React.useEffect(() => {
    const onBus = (e: Event) => {
      const { type, text, ttl } = (e as BusEvent).detail;
      show(type, text, ttl);
    };
    window.addEventListener(BUS, onBus as EventListener);
    return () => window.removeEventListener(BUS, onBus as EventListener);
  }, [show]);

  const node = (
    <div className={TOAST_LAYER}>
      <div className={TOAST_STACK}>
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              TOAST_PILL_BASE,
              t.type === "success" && TOAST_SUCCESS,
              t.type === "error" && TOAST_ERROR,
              t.type === "info" && TOAST_INFO,
              t.phase === "in" && "toast-enter",
              t.phase === "hold" && "toast-hold",
              t.phase === "out" && "toast-exit",
              "flex items-center justify-between gap-3"
            )}
          >
            <span className="min-w-0 flex-1">{t.text}</span>

            <button
              type="button"
              aria-label="Close"
              className="shrink-0 opacity-80 hover:opacity-100"
              onClick={() => dismiss(t.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Ctx.Provider value={{ show }}>
      {typeof document !== "undefined"
        ? createPortal(node, document.body)
        : null}
    </Ctx.Provider>
  );
}
