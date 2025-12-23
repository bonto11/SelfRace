// src/shared/hooks/useUserId.ts
"use client";

import * as React from "react";

type WhoAmI = { id: number | null; uuid: string | null };

// modulová cache (jedno volanie / session)
let cached: WhoAmI | null = null;
let inflight: Promise<WhoAmI> | null = null;

async function fetchWhoAmI(): Promise<WhoAmI> {
  const res = await fetch("/api/auth/whoami", {
    credentials: "include",
    cache: "no-store",
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch (e) {
  }

  const parsed: WhoAmI = {
    id: Number.isFinite(json?.id) ? Number(json.id) : null,
    uuid: typeof json?.uuid === "string" ? json.uuid : null,
  };

  return parsed;
}

export function useUserId() {
  // initial (z cache ak je)
  const [state, setState] = React.useState<WhoAmI>(() => {
    return cached ?? { id: null, uuid: null };
  });

  React.useEffect(() => {
    if (cached) {
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
    }

    inflight
      .then((v) => {
        setState(v);
      })
      .catch((e) => {
        setState({ id: null, uuid: null });
      });
  }, []);

  const refresh = React.useCallback(async () => {
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

  const value = React.useMemo(
    () => ({ userId: state.id, userUuid: state.uuid, refresh }),
    [state.id, state.uuid, refresh]
  );

  return value;
}