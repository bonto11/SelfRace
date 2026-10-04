// src/app/shared/components/ui/PageShell.tsx
"use client";

import * as React from "react";
import AppHeader, { type HeaderFrame } from "@/app/shared/ui/components/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens";

type Props = {
  title: string;
  showBack?: boolean;
  headerContainer?: boolean;
  rightSlot?: React.ReactNode;
  variant?: "stack" | "raw";
  contentClassName?: string;
  className?: string;
  children: React.ReactNode;
  showPoweredByStrava: boolean;
};

// Rozumny fallback kym sa nezmeria skutocna vyska (pri prvom rendri, kym
// ResizeObserver este nenahlasil realnu hodnotu) - lepsie mat mierne priveľký
// padding na zlomok sekundy nez ziadny.
const FALLBACK_HEADER_HEIGHT_PX = 76;

export default function PageShell({
  title,
  showBack = false,
  headerContainer = true,
  rightSlot,
  variant = "stack",
  className,
  contentClassName,
  children,
  showPoweredByStrava,
}: Props) {
  const [headerHeight, setHeaderHeight] = React.useState(FALLBACK_HEADER_HEIGHT_PX);
  const [frame, setFrame] = React.useState<HeaderFrame | null>(null);
  const frameRef = React.useRef<HTMLDivElement | null>(null);

  /*
   * Hlavička je position: fixed, takže sa centruje v CELOM okne. Obsah
   * stránky je v normálnom toku a centruje sa v priestore, ktorý mu dal
   * layout - na PC vedľa bočnej navigácie. Bez tohto merania bola hlavička
   * posunutá voči obsahu o polovicu šírky navigácie. Meriame preto
   * priestor stránky a hlavičku postavíme presne naň.
   */
  React.useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      const left = Math.round(r.left);
      const width = Math.round(r.width);
      setFrame((prev) =>
        prev && prev.left === left && prev.width === width ? prev : { left, width },
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div ref={frameRef} className="w-full">
      <AppHeader
        title={title}
        showBack={showBack}
        container={headerContainer}
        rightSlot={rightSlot}
        showPoweredByStrava={showPoweredByStrava}
        onHeightChange={setHeaderHeight}
        frame={frame}
      />

      <div
        className={[PAGE_CONTAINER, className].filter(Boolean).join(" ")}
        style={{ paddingTop: headerHeight }}
      >
        {variant === "stack" ? (
          <div className={[PAGE_STACK, contentClassName].filter(Boolean).join(" ")}>
            {children}
          </div>
        ) : (
          <div className={contentClassName}>{children}</div>
        )}
      </div>
    </div>
  );
}
