"use client";
import * as React from "react";
import { useRef, useEffect } from "react";
import { cx } from "@/app/shared/ui/utils/inputs";
import {
  FIELD_EDITABLE_BASE,
  FIELD_READONLY_BASE,
  FIELD_EDITABLE_STYLE,
  FIELD_READONLY_STYLE,
  FIELD_ERROR,
  FIELD_ERROR_STYLE,
  FIELD_LABEL,
  FIELD_HINT,
  FIELD_ERROR_TEXT,
  FORM_TEXT_VARS,
} from "@/app/shared/ui/tokens";

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
  variant?: "readonly" | "editable";
  disabled?: boolean;
  hh?: boolean;
  mm?: boolean;
  ss?: boolean;
  value: string; // "mm:ss" alebo "hh:mm:ss"
  onChange: (val: string) => void;
};

const ITEM_HEIGHT = 40;

function SnapColumn({
  max,
  value,
  onChange,
  disabled,
}: {
  max: number;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<any>(null);
  const options = Array.from({ length: max + 1 }, (_, i) => i);

  useEffect(() => {
    if (!isScrolling.current && scrollRef.current) {
      scrollRef.current.scrollTop = value * ITEM_HEIGHT;
    }
  }, [value]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (disabled) return;
    isScrolling.current = true;
    clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isScrolling.current = false;
    }, 150);

    const y = e.currentTarget.scrollTop;
    const idx = Math.max(0, Math.min(options.length - 1, Math.round(y / ITEM_HEIGHT)));
    const val = options[idx];
    if (val !== undefined && val !== value) {
      onChange(val);
    }
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-full flex-1 overflow-y-auto snap-y snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] outline-none"
      style={{ touchAction: "pan-y" }}
    >
      <div style={{ height: `${ITEM_HEIGHT}px` }} />
      {options.map((val) => {
        const isSelected = val === value;
        return (
          <div
            key={val}
            style={{ height: `${ITEM_HEIGHT}px` }}
            className={cx(
              "snap-center flex items-center justify-center transition-all duration-200 select-none",
              isSelected
                ? "text-2xl font-black text-white"
                : "text-sm font-medium text-white/30"
            )}
          >
            {val.toString().padStart(2, "0")}
          </div>
        );
      })}
      <div style={{ height: `${ITEM_HEIGHT}px` }} />
    </div>
  );
}

export default function TimeSelectorField({
  label,
  hint,
  error,
  containerClassName,
  variant = "editable",
  disabled = false,
  hh = false,
  mm = true,
  ss = true,
  value,
  onChange,
}: Props) {
  const editable = variant === "editable";
  const effectiveDisabled = disabled || !editable;
  const baseClass = editable ? FIELD_EDITABLE_BASE : FIELD_READONLY_BASE;

  const style = {
    ...(editable ? FIELD_EDITABLE_STYLE : FIELD_READONLY_STYLE),
    ...(error ? FIELD_ERROR_STYLE : null),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  // Bezpečný fallback ak nie je zadaná hodnota
  const safeValue = value || (hh ? "00:00:00" : "00:00");
  const parts = safeValue.split(":").map(n => isNaN(Number(n)) ? 0 : Number(n));
  
  let initialH = 0, initialM = 0, initialS = 0;
  if (parts.length === 3) {
    [initialH, initialM, initialS] = parts;
  } else if (parts.length === 2) {
    [initialM, initialS] = parts;
  }

  const handleColumnChange = (type: "h" | "m" | "s", newVal: number) => {
    let newH = type === "h" ? newVal : initialH;
    let newM = type === "m" ? newVal : initialM;
    let newS = type === "s" ? newVal : initialS;

    const arr = [];
    if (hh) arr.push(newH.toString().padStart(2, "0"));
    if (mm) arr.push(newM.toString().padStart(2, "0"));
    if (ss) arr.push(newS.toString().padStart(2, "0"));

    onChange(arr.join(":"));
  };

  return (
    <div className={cx("space-y-1", containerClassName)} style={style}>
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <div
        className={cx(
          baseClass,
          error && FIELD_ERROR,
          "relative h-[120px] p-0 flex items-center justify-center overflow-hidden rounded-xl border border-transparent"
        )}
      >
        <div className="absolute top-1/2 left-2 right-2 h-[40px] -translate-y-1/2 bg-white/10 rounded-lg pointer-events-none" />

        {hh && (
          <SnapColumn max={23} value={initialH} onChange={(v) => handleColumnChange("h", v)} disabled={effectiveDisabled} />
        )}
        
        {hh && (mm || ss) && <span className="font-bold text-white/50 z-10 -mx-1">:</span>}

        {mm && (
          <SnapColumn max={59} value={initialM} onChange={(v) => handleColumnChange("m", v)} disabled={effectiveDisabled} />
        )}

        {mm && ss && <span className="font-bold text-white/50 z-10 -mx-1">:</span>}

        {ss && (
          <SnapColumn max={59} value={initialS} onChange={(v) => handleColumnChange("s", v)} disabled={effectiveDisabled} />
        )}
      </div>

      {error ? (
        <div className={FIELD_ERROR_TEXT}>{error}</div>
      ) : hint ? (
        <div className={FIELD_HINT}>{hint}</div>
      ) : null}
    </div>
  );
}