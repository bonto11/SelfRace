// src/shared/hooks/useUserId.ts
"use client";

import * as React from "react";

const DEBUG = true;

type WhoAmI = { id: number | null; uuid: string | null };

// modulová cache (jedno volanie / session)
let cached: WhoAmI | null = null;
let inflight: Promise<WhoAmI> | null = null;

async function fetchWhoAmI(): Promise<WhoAmI> {
  DEBUG && console.log("[WHOAMI][cli] fetch start -> /api/auth/whoami");
  const res = await fetch("/api/auth/whoami", {
    credentials: "include",
    cache: "no-store",
  });

  DEBUG && console.log("[WHOAMI][cli] response", res.status, res.ok);

  let json: any = null;
  try {
    json = await res.json();
  } catch (e) {
    DEBUG && console.warn("[WHOAMI][cli] failed to parse json", e);
  }

  DEBUG && console.log("[WHOAMI][cli] raw json ->", json);

  const parsed: WhoAmI = {
    id: Number.isFinite(json?.id) ? Number(json.id) : null,
    uuid: typeof json?.uuid === "string" ? json.uuid : null,
  };

  DEBUG && console.log("[WHOAMI][cli] parsed ->", parsed);
  return parsed;
}

export function useUserId() {
  // initial (z cache ak je)
  const [state, setState] = React.useState<WhoAmI>(() => {
    DEBUG && console.log("[WHOAMI][cli] hook mount, cached =", cached);
    return cached ?? { id: null, uuid: null };
  });

  React.useEffect(() => {
    if (cached) {
      DEBUG && console.log("[WHOAMI][cli] useEffect: using cached =", cached);
      return;
    }
    if (!inflight) {
      inflight = fetchWhoAmI()
        .then((v) => {
          cached = v;
          return v;
        })
        .finally(() => {
          inflight = null;
        });
    } else {
      DEBUG && console.log("[WHOAMI][cli] useEffect: join inflight");
    }

    inflight
      .then((v) => {
        DEBUG && console.log("[WHOAMI][cli] inflight resolved ->", v);
        setState(v);
      })
      .catch((e) => {
        DEBUG && console.warn("[WHOAMI][cli] inflight error", e);
        setState({ id: null, uuid: null });
      });
  }, []);

  const refresh = React.useCallback(async () => {
    DEBUG && console.log("[WHOAMI][cli] refresh()");
    cached = null;
    setState({ id: null, uuid: null });
    try {
      const v = await fetchWhoAmI();
      cached = v;
      setState(v);
      DEBUG && console.log("[WHOAMI][cli] refresh done ->", v);
    } catch (e) {
      DEBUG && console.warn("[WHOAMI][cli] refresh error", e);
      setState({ id: null, uuid: null });
    }
  }, []);

  const value = React.useMemo(
    () => ({ userId: state.id, userUuid: state.uuid, refresh }),
    [state.id, state.uuid, refresh]
  );

  DEBUG && console.log("[WHOAMI][cli] return value ->", value);
  return value;
}