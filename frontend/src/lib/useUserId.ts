"use client";

import { useEffect, useState } from "react";
import { useUser } from "./useUser";
import  getUserId  from "./getUserId";

export function useUserId() {
  const { user, loading: userLoading } = useUser();
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserId() {
      if (user?.id) {
        const dbId = await getUserId(user.id); // auth.uid → int id
        setUserId(dbId);
      } else {
        setUserId(null);
      }
      setLoading(false);
    }
    fetchUserId();
  }, [user]);

  return { userId, loading };
}
