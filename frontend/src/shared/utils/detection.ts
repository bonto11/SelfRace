import { useEffect, useState } from "react";

export function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const viaMQ =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)")?.matches;
    const viaPts =
      typeof navigator !== "undefined" && (navigator as any).maxTouchPoints > 0;
    const viaOn = typeof window !== "undefined" && "ontouchstart" in window;
    setIsTouch(!!(viaMQ || viaPts || viaOn));
    console.debug("[PBRun] touch detection:", {
      viaMQ,
      viaPts,
      viaOn,
      decided: !!(viaMQ || viaPts || viaOn),
    });
  }, []);
  return isTouch;
}