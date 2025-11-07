// src/features/Toolbars/hooks/useBodyScrollLock.ts
import { useEffect } from "react";

export function useBodyScrollLock(lock: boolean) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (lock) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lock]);
}