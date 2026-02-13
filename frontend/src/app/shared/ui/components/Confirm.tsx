// shared/components/ui/Confirm.tsx
"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import Button from "./Button";
import { cx } from "@/app/shared/ui/utils/inputs";
import { useT } from "@/app/shared/i18n/useT";
import {
  SURFACE_CARD,
  SURFACE_CARD_STYLE,
  CARD_HEAD_INSET,
  CARD_BODY_INSET,
  MUTED_TEXT,
  MUTED_TEXT_STYLE,
} from "@/app/shared/ui/tokens";

/* ---------- verejné API (hook + singleton) ---------- */
type Options = {
  title?: string;
  message?: string;
  okText?: string;
  cancelText?: string;
  tone?: "danger" | "default";
};

type Ask = (opts: Options) => Promise<boolean>;

const Ctx = React.createContext<Ask | null>(null);

export function useConfirm(): Ask {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("ConfirmHost missing");
  return ctx;
}

// — singleton bus —
const BUS = "up:confirm";
type BusDetail = { opts: Options; resolve: (v: boolean) => void };
declare global {
  interface WindowEventMap {
    [BUS]: CustomEvent<BusDetail>;
  }
}

export function confirm(opts: Options) {
  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    const ev = new CustomEvent<BusDetail>(BUS, { detail: { opts, resolve } });
    window.dispatchEvent(ev);
  });
}

/* ---------------- host / renderer -------------------- */
type Item = { id: number; opts: Options; resolve: (v: boolean) => void };

export default function ConfirmHost() {
  const [queue, setQueue] = React.useState<Item[]>([]);

  React.useEffect(() => {
    const onBus = (e: CustomEvent<BusDetail>) => {
      const id = Date.now() + Math.random();
      setQueue((q) => [...q, { id, ...e.detail }]);
    };
    window.addEventListener(BUS, onBus as EventListener);
    return () => window.removeEventListener(BUS, onBus as EventListener);
  }, []);

  const ask: Ask = (opts) => confirm(opts);

  const node = (
    <>
      {queue.map((it) => (
        <Sheet
          key={it.id}
          item={it}
          onClose={(v) => {
            it.resolve(v);
            setQueue((q) => q.filter((x) => x.id !== it.id));
          }}
        />
      ))}
    </>
  );

  return (
    <Ctx.Provider value={ask}>
      {typeof document !== "undefined"
        ? createPortal(node, document.body)
        : null}
    </Ctx.Provider>
  );
}

/* ----------------- vizuál dialógu -------------------- */
function Sheet({
  item,
  onClose,
}: {
  item: Item;
  onClose: (v: boolean) => void;
}) {
  const t = useT();

  // Predvolené texty z katalógu, ak chýbajú v opts
  const {
    title = t("common.confirm.title"),
    message = "",
    okText = t("common.confirm.ok"),
    cancelText = t("common.confirm.cancel"),
    tone = "default",
  } = item.opts;

  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setShow(true), 10);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[70]">
      {/* backdrop */}
      <div
        onClick={() => onClose(false)}
        className={cx(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          show ? "opacity-100" : "opacity-0",
        )}
      />

      {/* card */}
      <div
        className={cx(
          "absolute left-1/2 -translate-x-1/2 transition-all duration-250",
          show ? "top-[22vh] opacity-100" : "top-[20vh] opacity-0",
        )}
      >
        <div
          className={cx(
            SURFACE_CARD,
            "w-[92vw] max-w-[420px] mx-auto rounded-3xl shadow-xl",
          )}
          style={SURFACE_CARD_STYLE}
        >
          <div className={cx(CARD_HEAD_INSET, "text-center")}>
            <div className="text-base font-semibold">{title}</div>
            {message ? (
              <div
                className={cx("text-sm mt-1", MUTED_TEXT)}
                style={MUTED_TEXT_STYLE}
              >
                {message}
              </div>
            ) : null}
          </div>

          <div
            className={cx(CARD_BODY_INSET, "pt-0 flex gap-3 justify-center")}
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onClose(false)}
              className="min-w-[110px]"
            >
              {cancelText}
            </Button>
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              size="sm"
              onClick={() => onClose(true)}
              className="min-w-[110px]"
            >
              {okText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}