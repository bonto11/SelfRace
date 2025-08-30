// src/lib/useUserId.ts
"use client";

import { useEffect, useState } from "react";
import { useUser } from "./useUser";
import { getUserId } from "./getUserId";

export function useUserId() {
  const { user, loading: userLoading } = useUser();
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserId() {
      console.log("➡️ useUserId: user =", user);

      if (user?.id) {
        const dbId = await getUserId(user.id); // auth_uid → int id
        console.log("➡️ useUserId: dbId =", dbId);
        setUserId(dbId);
      } else {
        console.warn("❌ useUserId: žiadny user");
        setUserId(null);
      }
      setLoading(false);
    }
    fetchUserId();
  }, [user]);

  return { userId, loading: userLoading || loading };
}
