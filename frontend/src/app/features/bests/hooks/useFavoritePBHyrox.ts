"use client";
import { useEffect, useState, useCallback } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

export function useFavoritePBHyrox() {
  const { userId } = useUserId();
  const [favM, setFavMState] = useState<number | null>(null);

  useEffect(() => {
    const fromLS = localStorage.getItem("fav_pb_hyrox");
    if (fromLS) setFavMState(Number(fromLS));
  }, []);

  const setFavM = useCallback(
    async (m: number | null) => {
      setFavMState(m);
      if (m) localStorage.setItem("fav_pb_hyrox", String(m));
      else localStorage.removeItem("fav_pb_hyrox");
    },
    [userId]
  );
  return { favM, setFavM };
}
export default useFavoritePBHyrox;