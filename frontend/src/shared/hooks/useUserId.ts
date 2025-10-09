// src/lib/useUserId.ts
/*
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
      //console.log("➡️ useUserId: user =", user);

      if (user?.id) {
        const dbId = await getUserId(user.id); // auth_uid → int id
        //console.log("➡️ useUserId: dbId =", dbId);
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
*/


// src/shared/hooks/useUserId.ts  (prepíš)
"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/shared/utils/supabaseBrowser";
import { API_URL } from "@/shared/config";

/** Vracia interné DB user_id (number). */
export function useUserId() {
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        // 1) získaj UUID zo Supabase
        const sb = getSupabaseBrowser();
        const { data } = await sb.auth.getUser();
        const uuid = data.user?.id;
        if (!uuid) {
          setUserId(null);
          return;
        }

        // 2) zmapuj UUID -> interné numeric id cez BE
        const res = await fetch(`${API_URL}/users/resolve`, {
          method: "POST", // alebo GET ?uid=... ak to tak máš
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ supabase_uid: uuid }),
          credentials: "include", // ak BE používa cookie auth
        });

        const json = await res.json().catch(() => ({}));
        const id = Number(json?.user_id ?? json?.id);
        setUserId(Number.isFinite(id) ? id : null);
      } catch {
        setUserId(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return { userId, loading };
}
export default useUserId;
