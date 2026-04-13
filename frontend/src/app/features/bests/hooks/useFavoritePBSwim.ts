"use client";

import { useEffect, useState, useCallback } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

export function useFavoritePBSwim() {
  const { userId } = useUserId();
  const [favM, setFavMState] = useState<number | null>(null);

  useEffect(() => {
    const fromLS = localStorage.getItem("fav_pb_swim");
    if (fromLS) setFavMState(Number(fromLS));
  }, []);

  const setFavM = useCallback(
    async (m: number | null) => {
      setFavMState(m);
      if (m) localStorage.setItem("fav_pb_swim", String(m));
      else localStorage.removeItem("fav_pb_swim");
      // TODO: Pridaj uloženie do DB, podobne ako máš setFavPBRunDB
    },
    [userId]
  );

  return { favM, setFavM };
}

export default useFavoritePBSwim;