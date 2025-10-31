"use client";
import { useEffect, useState } from "react";

const KEY = "pb.run.fav_m";

export function useFavoritePBRun() {
  const [favM, setFavM] = useState<number>(5000);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(KEY));
      if (Number.isFinite(v) && v > 0) setFavM(v);
    } catch {}
  }, []);

  const save = (m: number) => {
    setFavM(m);
    try { localStorage.setItem(KEY, String(m)); } catch {}
  };

  return { favM, setFavM: save };
}
