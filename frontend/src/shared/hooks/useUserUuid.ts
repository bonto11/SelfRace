// src/shared/hooks/useUserUuid.ts
"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/shared/utils/supabaseBrowser";

/** Supabase user UUID (string) – len keď naozaj potrebuješ. */
export function useUserUuid() {
  const [uuid, setUuid] = useState<string | null>(null);

  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(({ data }) => {
      setUuid(data.user?.id ?? null);
    });
  }, []);

  return uuid;
}
