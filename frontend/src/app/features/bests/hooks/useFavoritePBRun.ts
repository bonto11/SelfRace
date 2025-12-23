"use client";

import { useEffect, useState, useCallback } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { getFavPBRunFromLS, setFavPBRunDB } from "@/app/features/prefs/utils/favPB";

export function useFavoritePBRun() {
  const { userId } = useUserId();
  const [favM, setFavMState] = useState<number | null>(null);

  useEffect(() => {
    setFavMState(getFavPBRunFromLS()); // okamžitý init z LS
  }, []);

  const setFavM = useCallback(
    async (m: number | null) => {
      setFavMState(m); // hneď zafarbí ★
      await setFavPBRunDB(userId, m); // DB + LS
    },
    [userId]
  );

  return { favM, setFavM };
}

export default useFavoritePBRun;
