"use client";
import * as React from "react";
import { useRef, useEffect, useState } from "react";
import { cx } from "@/app/shared/ui/utils/inputs";
import {
  FIELD_EDITABLE_BASE,
  FIELD_READONLY_BASE,
  FIELD_EDITABLE_STYLE,
  FIELD_READONLY_STYLE,
  FIELD_ERROR,
  FIELD_ERROR_STYLE,
  FIELD_LABEL,
  FIELD_ERROR_TEXT,
  FORM_TEXT_VARS,
} from "@/app/shared/ui/tokens";

type Props = {
  label?: string;
  error?: string;
  containerClassName?: string;
  variant?: "readonly" | "editable";
  disabled?: boolean;
  hh?: boolean;
  mm?: boolean;
  ss?: boolean;
  value: string;
  onChange: (val: string) => void;
};

const ITEM_HEIGHT = 40;

function SnapColumn({
  max,
  value,
  onChange,
  disabled,
  expanded,
}: {
  max: number;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  expanded: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<any>(null);
  const options = Array.from({ length: max + 1 }, (_, i) => i);

  // Okamžité nastavenie scrollu (bez smooth, aby to nespôsobovalo bugy na iOS)
  useEffect(() => {
    if (expanded && scrollRef.current && !isScrolling.current) {
      scrollRef.current.scrollTop = value * ITEM_HEIGHT;
    }
  }, [value, expanded]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (disabled) return;
    isScrolling.current = true;
    clearTimeout(scrollTimeout.current);
    
    scrollTimeout.current = setTimeout(() => { 
      isScrolling.current = false; 
    }, 150);
    
    const y = e.currentTarget.scrollTop;
    const idx = Math.max(0, Math.min(options.length - 1, Math.round(y / ITEM_HEIGHT)));
    
    if (options[idx] !== undefined && options[idx] !== value) {
      onChange(options[idx]);
    }
  };

  const stepValue = (direction: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const newVal = Math.max(0, Math.min(max, value + direction));
    onChange(newVal);
  };

  return (
    <div className="relative h-full flex-1 group/col">
      <button type="button" onClick={(e) => stepValue(-1, e)} disabled={value === 0} className="absolute top-0 left-0 right-0 h-8 z-20 flex items-center justify-center bg-gradient-to-b from-white/20 to-transparent opacity-0 sm:group-hover/col:opacity-100 transition-opacity">
        <svg className="w-4 h-4 text-black/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 15l7-7 7 7" /></svg>
      </button>
      
      <div ref={scrollRef} onScroll={handleScroll} className="h-full w-full overflow-y-auto overscroll-y-none snap-y snap-mandatory [&::-webkit-scrollbar]:hidden outline-none" style={{ touchAction: "pan-y" }}>
        <div style={{ height: `${ITEM_HEIGHT}px` }} />
        {options.map((val) => (
          <div 
            key={val} 
            style={{ height: `${ITEM_HEIGHT}px` }} 
            className={cx(
              "snap-center flex items-center justify-center transition-all duration-200 select-none", 
              // Výrazné zvýraznenie aktuálneho čísla
              val === value ? "text-xl text-black font-bold scale-110" : "text-sm text-black/40 scale-100"
            )}
          >
            {val.toString().padStart(2, "0")}
          </div>
        ))}
        <div style={{ height: `${ITEM_HEIGHT}px` }} />
      </div>
      
      <button type="button" onClick={(e) => stepValue(1, e)} disabled={value === max} className="absolute bottom-0 left-0 right-0 h-8 z-20 flex items-center justify-center bg-gradient-to-t from-white/20 to-transparent opacity-0 sm:group-hover/col:opacity-100 transition-opacity">
        <svg className="w-4 h-4 text-black/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M19 9l-7 7-7-7" /></svg>
      </button>
    </div>
  );
}

export default function TimeSelectorField({
  label,
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
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const style = {
    ...(editable ? FIELD_EDITABLE_STYLE : FIELD_READONLY_STYLE),
    ...(error ? FIELD_ERROR_STYLE : null),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  // 1. BEZPEČNÝ FALLBACK
  const activeColumnsCount = [hh, mm, ss].filter(Boolean).length;
  const fallbackArr = Array(activeColumnsCount).fill("00");
  const safeValue = value || fallbackArr.join(":");
  
  // 2. OPRAVENÁ LOGIKA PARSOVANIA
  const parts = safeValue.split(":").map(n => isNaN(Number(n)) ? 0 : Number(n));
  let pIdx = 0;
  const currentH = hh ? (parts[pIdx++] ?? 0) : 0;
  const currentM = mm ? (parts[pIdx++] ?? 0) : 0;
  const currentS = ss ? (parts[pIdx++] ?? 0) : 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setExpanded(false);
    };
    if (expanded) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded]);

  useEffect(() => {
    if (expanded) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [expanded]);

  // 3. OPRAVENÁ LOGIKA UKLADANIA
  const handleColumnChange = (type: "h" | "m" | "s", newVal: number) => {
    const newH = type === "h" ? newVal : currentH;
    const newM = type === "m" ? newVal : currentM;
    const newS = type === "s" ? newVal : currentS;
    
    const arr = [];
    if (hh) arr.push(newH.toString().padStart(2, "0"));
    if (mm) arr.push(newM.toString().padStart(2, "0"));
    if (ss) arr.push(newS.toString().padStart(2, "0"));
    
    onChange(arr.join(":"));
  };

  return (
    <div 
      className={cx("space-y-1 w-full", expanded ? "relative z-50" : "", containerClassName)} 
      style={style} 
      ref={containerRef}
    >
      {expanded && (
        <div 
          className="fixed inset-0 z-40" 
          style={{ touchAction: "none" }} 
          onClick={() => setExpanded(false)} 
        />
      )}

      {label ? <label className={FIELD_LABEL}>{label}</label> : null}
      
      {!expanded ? (
        <div
          onClick={() => !effectiveDisabled && setExpanded(true)}
          className={cx(baseClass, error && FIELD_ERROR, "flex items-center px-3 h-[38px] cursor-pointer text-black transition-colors font-medium")}
        >
          <span>{safeValue}</span>
        </div>
      ) : (
        <div className={cx(baseClass, error && FIELD_ERROR, "relative z-50 h-[120px] p-0 flex items-center justify-center overflow-hidden rounded-xl border-gray-300 shadow-inner group")}>
          <div className="absolute top-1/2 left-2 right-2 h-[40px] -translate-y-1/2 bg-black/5 rounded-lg pointer-events-none" />
          
          {hh && <SnapColumn max={23} value={currentH} onChange={(v) => handleColumnChange("h", v)} disabled={effectiveDisabled} expanded={expanded} />}
          {hh && (mm || ss) && <span className="text-black/40 z-10 -mx-1 font-bold">:</span>}
          
          {mm && <SnapColumn max={59} value={currentM} onChange={(v) => handleColumnChange("m", v)} disabled={effectiveDisabled} expanded={expanded} />}
          {mm && ss && <span className="text-black/40 z-10 -mx-1 font-bold">:</span>}
          
          {ss && <SnapColumn max={59} value={currentS} onChange={(v) => handleColumnChange("s", v)} disabled={effectiveDisabled} expanded={expanded} />}
        </div>
      )}
      {error ? <div className={FIELD_ERROR_TEXT}>{error}</div> : null}
    </div>
  );
}
