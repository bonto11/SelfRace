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
/** pohodlné volanie bez hooku */
export const toast = {
  success(text: string, ttl?: number) { emit({ type: "success", text, ttl }); },
  error(text: string, ttl?: number)   { emit({ type: "error", text, ttl }); },
  info(text: string, ttl?: number)    { emit({ type: "info", text, ttl }); },
};

// ---- jeden vizuálny toast s animáciou --------------------------------------
function ToastItemView({
  item, onDone,
}: { item: ToastItem; onDone: (id: number) => void }) {
  const [state, setState] = React.useState<"enter" | "show" | "leave">("enter");

  // enter -> show
  React.useEffect(() => {
    const t1 = setTimeout(() => setState("show"), 10);
    // leave po TTL
    const t2 = setTimeout(() => setState("leave"), item.ttl);
    // remove po animácii leave
    const t3 = setTimeout(() => onDone(item.id), item.ttl + 250);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [item.id, item.ttl, onDone]);

  return (
    <div
      className={cx(
        "pointer-events-auto select-none rounded-xl border shadow-lg",
        "px-4 py-3 text-sm leading-5",
        "w-[360px] max-w-[90vw]",     // fixná šírka (text sa zalomí, výška rastie)
        // farby podľa typu
        item.type === "success" && "bg-emerald-600 text-white border-emerald-700",
        item.type === "error"   && "bg-red-600 text-white border-red-700",
        item.type === "info"    && "bg-gray-800 text-white border-gray-700",
        // animácia: sprava -> stred -> doprava
        "transition-all duration-200 ease-out will-change-transform opacity-0 translate-x-8",
        state === "show"  && "opacity-100 translate-x-0",
        state === "leave" && "opacity-0 translate-x-8"
      )}
      role="status"
      aria-live="polite"
    >
      {item.text}
    </div>
  );
}

// ---- host (renderer) --------------------------------------------------------
export default function ToastHost() {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const show = (type: ToastType, text: string, ttl = 2500) => {
    const id = Date.now() + Math.random();
    setItems(arr => [...arr, { id, type, text, ttl }]);
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

  const remove = (id: number) => setItems(arr => arr.filter(x => x.id !== id));

  const node = (
    // pozícia: hore pod headerom (cca 72–96px), center
    <div className="pointer-events-none fixed inset-x-0 top-20 md:top-24 z-[60] flex justify-center">
      <div className="flex flex-col gap-2">
        {items.map(t => (
          <ToastItemView key={t.id} item={t} onDone={remove} />
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