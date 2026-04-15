"use client";
import * as React from "react";
import { useMemo, useRef, useEffect, useState } from "react";
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
  className?: string;
  variant?: "readonly" | "editable";
  disabled?: boolean;
  min: number;
  max: number;
  step?: number;
  value: number | null | "";
  onChange: (val: number) => void;
};

const ITEM_HEIGHT = 40;

export default function NumberWheelField({
  label,
  error,
  containerClassName,
  className,
  variant = "editable",
  disabled,
  min,
  max,
  step = 1,
  value,
  onChange,
}: Props) {
  const editable = variant === "editable";
  const effectiveDisabled = disabled || !editable;
  const baseClass = editable ? FIELD_EDITABLE_BASE : FIELD_READONLY_BASE;

  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<any>(null);

  const style = {
    ...(editable ? FIELD_EDITABLE_STYLE : FIELD_READONLY_STYLE),
    ...(error ? FIELD_ERROR_STYLE : null),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  const options = useMemo(() => {
    const opts = [];
    for (let i = min; i <= max; i += step) opts.push(i);
    return opts;
  }, [min, max, step]);

  const safeValue = typeof value === "number" ? value : min;

  // Kliknutie mimo zatvorí bubon
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    if (expanded) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded]);

  // Ultimátny zámok scrollovania (iOS fix)
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

  // Vycentrovanie po otvorení (opravené na okamžité bez smooth pre iOS)
  useEffect(() => {
    if (expanded && scrollRef.current && !isScrolling.current) {
      const idx = options.indexOf(safeValue);
      if (idx >= 0) {
        scrollRef.current.scrollTop = idx * ITEM_HEIGHT;
      }
    }
  }, [expanded, safeValue, options]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (effectiveDisabled) return;
    isScrolling.current = true;
    clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => { isScrolling.current = false; }, 150);
    const y = e.currentTarget.scrollTop;
    const idx = Math.max(0, Math.min(options.length - 1, Math.round(y / ITEM_HEIGHT)));
    const val = options[idx];
    if (val !== undefined && val !== value) {
      onChange(val);
    }
  };

  const stepValue = (direction: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    if (effectiveDisabled) return;
    const currentIndex = options.indexOf(safeValue);
    const newIndex = Math.max(0, Math.min(options.length - 1, currentIndex + direction));
    onChange(options[newIndex]);
  };

  return (
    <div 
      className={cx("space-y-1 w-full", expanded ? "relative z-50" : "", containerClassName)} 
      style={style} 
      ref={containerRef}
    >
      {/* Ochranná neviditeľná vrstva (zastaví posun mimo bubna) */}
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
          className={cx(baseClass, error && FIELD_ERROR, className, "flex items-center px-3 h-[38px] cursor-pointer text-black transition-colors font-medium")}
        >
          {value === "" || value === null ? <span className="opacity-50">—</span> : <span>{safeValue}</span>}
        </div>
      ) : (
        <div className={cx(baseClass, error && FIELD_ERROR, className, "relative z-50 h-[120px] p-0 overflow-hidden flex items-center rounded-xl border-gray-300 shadow-inner group")}>
          <button type="button" onClick={(e) => stepValue(-1, e)} className="absolute top-0 left-0 right-0 h-8 z-20 flex items-center justify-center bg-gradient-to-b from-white/20 to-transparent opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4 text-black/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 15l7-7 7 7" /></svg>
          </button>
          
          <div className="absolute top-1/2 left-2 right-2 h-[40px] -translate-y-1/2 bg-black/5 rounded-lg pointer-events-none" />
          
          {/* overscroll-y-none zabráni "gumenému" ťahaniu stránky */}
          <div ref={scrollRef} onScroll={handleScroll} className="h-full w-full overflow-y-auto overscroll-y-none snap-y snap-mandatory [&::-webkit-scrollbar]:hidden outline-none" style={{ touchAction: "pan-y" }}>
            <div style={{ height: `${ITEM_HEIGHT}px` }} />
            {options.map((val) => (
              <div 
                key={val} 
                style={{ height: `${ITEM_HEIGHT}px` }} 
                className={cx(
                  "snap-center flex items-center justify-center transition-all duration-200 select-none", 
                  val === safeValue ? "text-xl text-black font-bold scale-110" : "text-sm text-black/40 scale-100"
                )}
              >
                {val}
              </div>
            ))}
            <div style={{ height: `${ITEM_HEIGHT}px` }} />
          </div>

          <button type="button" onClick={(e) => stepValue(1, e)} className="absolute bottom-0 left-0 right-0 h-8 z-20 flex items-center justify-center bg-gradient-to-t from-white/20 to-transparent opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4 text-black/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
      )}
      {error ? <div className={FIELD_ERROR_TEXT}>{error}</div> : null}
    </div>
  );
}
