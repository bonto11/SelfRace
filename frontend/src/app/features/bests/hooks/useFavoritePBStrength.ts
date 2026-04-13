"use client";
import { useEffect, useState, useCallback } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

export function useFavoritePBStrength() {
  const { userId } = useUserId();
  const [favM, setFavMState] = useState<number | null>(null);

  useEffect(() => {
    const fromLS = localStorage.getItem("fav_pb_strength");
    if (fromLS) setFavMState(Number(fromLS));
  }, []);

  const setFavM = useCallback(
    async (m: number | null) => {
      setFavMState(m);
      if (m) localStorage.setItem("fav_pb_strength", String(m));
      else localStorage.removeItem("fav_pb_strength");
    },
    [userId]
  );

  return { favM, setFavM };
}
export default useFavoritePBStrength;