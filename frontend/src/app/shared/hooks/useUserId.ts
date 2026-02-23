// src/shared/hooks/useUserId.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

type WhoAmI = { id: number | null; uuid: string | null };

let cached: WhoAmI | null = null;
let inflight: Promise<WhoAmI> | null = null;

async function fetchWhoAmI(): Promise<WhoAmI> {
  const res = await fetch("/api/auth/whoami", {
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    return { id: null, uuid: null }; // Ak API zlyhá, bezpečne vrátime null
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch (e) {
    return { id: null, uuid: null };
  }

  return {
    id: Number.isFinite(json?.id) ? Number(json.id) : null,
    uuid: typeof json?.uuid === "string" ? json.uuid : null,
  };
}

export function useUserId() {
  const [state, setState] = useState<WhoAmI>(() => cached ?? { id: null, uuid: null });

  useEffect(() => {
    if (cached) return;

    if (!inflight) {
      inflight = fetchWhoAmI()
        .then((v) => {
          cached = v;
          return v;
        })
        .finally(() => {
          inflight = null;
        });
    }

    inflight
      .then((v) => setState(v))
      .catch(() => setState({ id: null, uuid: null }));
  }, []);

  const refresh = useCallback(async () => {
    cached = null;
    setState({ id: null, uuid: null });
    try {
      const v = await fetchWhoAmI();
      cached = v;
      setState(v);
    } catch (e) {
      setState({ id: null, uuid: null });
    }
  }, []);

  const value = useMemo(
    () => ({ userId: state.id, userUuid: state.uuid, refresh }),
    [state.id, state.uuid, refresh]
  );

  return value;
}