// src/shared/hooks/useOrientation.ts
"use client";
import { useEffect, useState } from "react";

export function useOrientation() {
  const [isPortrait, setPortrait] = useState<boolean>(true);

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const update = () => setPortrait(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return { isPortrait };
}
