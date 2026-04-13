"use client";

import { useEffect, useState, useCallback } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

export function useFavoritePBRide() {
  const { userId } = useUserId();
  const [favM, setFavMState] = useState<number | null>(null);

  useEffect(() => {
    const fromLS = localStorage.getItem("fav_pb_ride");
    if (fromLS) setFavMState(Number(fromLS));
  }, []);

  const setFavM = useCallback(
    async (m: number | null) => {
      setFavMState(m);
      if (m) localStorage.setItem("fav_pb_ride", String(m));
      else localStorage.removeItem("fav_pb_ride");
      // TODO: Pridaj uloženie do DB, podobne ako máš setFavPBRunDB
    },
    [userId]
  );

  return { favM, setFavM };
}

export default useFavoritePBRide;