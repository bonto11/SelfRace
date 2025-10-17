// src/shared/hooks/useUserId.ts
"use client";

import { useEffect, useMemo, useState } from "react";

type WhoAmI = { id: number | null; uuid: string | null };
let cached: WhoAmI | null = null;
let inflight: Promise<WhoAmI> | null = null;

async function fetchWhoAmI(): Promise<WhoAmI> {
  const res = await fetch("/api/auth/whoami", { credentials: "include", cache: "no-store" });
  const json = await res.json().catch(() => ({} as any));
  return {
    id: Number.isFinite(json?.id) ? Number(json.id) : null,
    uuid: typeof json?.uuid === "string" ? json.uuid : null,
  };
}

export function useUserId() {
  const [state, setState] = useState<WhoAmI>(cached ?? { id: null, uuid: null });

  useEffect(() => {
    if (cached) return; // už máme
    if (!inflight) inflight = fetchWhoAmI().then(v => (cached = v)).finally(() => (inflight = null));
    inflight.then(v => setState(v)).catch(() => setState({ id: null, uuid: null }));
  }, []);

  const refresh = async () => {
    cached = null;
    setState({ id: null, uuid: null });
    const v = await fetchWhoAmI().catch(() => ({ id: null, uuid: null }));
    cached = v;
    setState(v);
  };

  return useMemo(() => ({ userId: state.id, userUuid: state.uuid, refresh }), [state.id, state.uuid]);
}