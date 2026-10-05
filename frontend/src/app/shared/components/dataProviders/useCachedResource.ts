"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cacheRead, cacheWrite } from "@/app/shared/utils/persistentCache";
import { beginBootLoad } from "@/app/shared/state/bootLoadStore";
import { onBackendMutation } from "@/app/shared/utils/callBackend";

/*
 * Jeden zdroj dát v provideri (napr. streak, athlete state, recovery riadky).
 *
 * - Dáta sa hneď ukážu z perzistentnej cache, čerstvé sa doťahujú na pozadí.
 * - Zdroj je lenivý: načíta sa až keď ho niekto potrebuje (ensure() vo
 *   widgete cez useEnsure) - provider teda pri štarte neťahá dáta pre
 *   sekcie, ktoré user ešte neotvoril.
 * - Viac widgetov s tým istým zdrojom zdieľa jeden request.
 * - ensure() znova načíta až keď sú dáta staršie ako staleMs, alebo keď
 *   prebehol akýkoľvek zápis na BE (dáta mohli zmeniť aj iné endpointy).
 * - Kým nemáme žiadne dáta (ani z cache), fetch drží úvodný splash.
 */

export type CachedResource<T> = {
  data: T | undefined;
  /** práve beží request */
  loading: boolean;
  /** máme dáta (z cache alebo BE), alebo prvý request už skončil (aj chybou) */
  loaded: boolean;
  error: boolean;
  /** aktivuje zdroj a načíta ho, ak treba */
  ensure: () => void;
  /** vynúti načítanie (napr. tlačidlo Obnoviť, po uložení) */
  refresh: () => Promise<void>;
  /** obnoví len zdroj, ktorý už niekto použil (globálny refresh providera) */
  revalidate: () => Promise<void>;
  /** lokálna úprava dát bez requestu (napr. po vytvorení záznamu) */
  setData: (updater: (prev: T | undefined) => T) => void;
};

type Options<T> = {
  /** null = ešte nemáme usera, nič sa nenačítava */
  key: string | null;
  fetcher: () => Promise<T>;
  staleMs?: number;
  persist?: boolean;
  /** načítať hneď (jadro providera), nie až pri prvom ensure() */
  eager?: boolean;
};

type State<T> = {
  key: string | null;
  data: T | undefined;
  loading: boolean;
  settled: boolean;
  error: boolean;
};

type Meta = {
  key: string | null;
  fetchedAt: number;
  inFlight: Promise<void> | null;
};

const DEFAULT_STALE_MS = 30_000;

function initialState<T>(key: string | null, persist: boolean): State<T> {
  if (!key || !persist) {
    return { key, data: undefined, loading: false, settled: false, error: false };
  }
  const cached = cacheRead<T>(key);
  return {
    key,
    data: cached ? cached.data : undefined,
    loading: false,
    settled: !!cached,
    error: false,
  };
}

export function useCachedResource<T>({
  key,
  fetcher,
  staleMs = DEFAULT_STALE_MS,
  persist = true,
  eager = false,
}: Options<T>): CachedResource<T> {
  const [state, setState] = useState<State<T>>(() => initialState<T>(key, persist));

  // Zmena kľúča (prihlásenie, iný user): stav sa prepne hneď v tomto
  // rendri na dáta z cache - bez prázdneho medzistavu.
  let current = state;
  if (state.key !== key) {
    current = initialState<T>(key, persist);
    setState(current);
  }

  const keyRef = useRef(key);
  keyRef.current = key;

  const metaRef = useRef<Meta>({ key, fetchedAt: 0, inFlight: null });
  if (metaRef.current.key !== key) {
    metaRef.current = { key, fetchedAt: 0, inFlight: null };
  }

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const staleMsRef = useRef(staleMs);
  staleMsRef.current = staleMs;

  const hasDataRef = useRef(false);
  hasDataRef.current = current.data !== undefined;

  const activeRef = useRef(eager);

  const doFetch = useCallback((): Promise<void> => {
    const k = keyRef.current;
    if (!k) return Promise.resolve();

    const meta = metaRef.current;
    if (meta.inFlight) return meta.inFlight;

    const endBoot = hasDataRef.current ? null : beginBootLoad();
    setState((s) => (s.key === k ? { ...s, loading: true } : s));

    const run = async () => {
      try {
        const data = await fetcherRef.current();
        if (keyRef.current !== k) return;
        meta.fetchedAt = Date.now();
        if (persist) cacheWrite(k, data);
        setState((s) =>
          s.key === k ? { key: k, data, loading: false, settled: true, error: false } : s,
        );
      } catch (e) {
        if (keyRef.current !== k) return;
        // aj pri chybe si zapamätáme čas - inak by každý mount widgetu
        // hneď skúšal znova
        meta.fetchedAt = Date.now();
        console.error(`[resource] ${k} load failed`, e);
        setState((s) =>
          s.key === k ? { ...s, loading: false, settled: true, error: true } : s,
        );
      } finally {
        endBoot?.();
      }
    };

    // run() nikdy nezlyhá (chyby rieši sám), takže finally je bezpečné
    const p = run();
    meta.inFlight = p;
    void p.finally(() => {
      if (meta.inFlight === p) meta.inFlight = null;
    });
    return p;
  }, [persist]);

  const ensure = useCallback(() => {
    activeRef.current = true;
    const meta = metaRef.current;
    if (!keyRef.current || meta.inFlight) return;
    if (meta.fetchedAt && Date.now() - meta.fetchedAt < staleMsRef.current) return;
    void doFetch();
  }, [doFetch]);

  const refresh = useCallback(() => {
    activeRef.current = true;
    return doFetch();
  }, [doFetch]);

  const revalidate = useCallback(() => {
    if (!activeRef.current) return Promise.resolve();
    return doFetch();
  }, [doFetch]);

  const setData = useCallback(
    (updater: (prev: T | undefined) => T) => {
      setState((s) => {
        if (!s.key) return s;
        const data = updater(s.data);
        if (persist) cacheWrite(s.key, data);
        return { ...s, data, settled: true };
      });
    },
    [persist],
  );

  // nový kľúč (user sa zistil / zmenil) - aktívny zdroj sa hneď načíta
  useEffect(() => {
    if (key && activeRef.current) void doFetch();
  }, [key, doFetch]);

  // akýkoľvek zápis na BE = dáta môžu byť staré, ďalší ensure() načíta znova
  useEffect(
    () =>
      onBackendMutation(() => {
        metaRef.current.fetchedAt = 0;
      }),
    [],
  );

  return useMemo(
    () => ({
      data: current.data,
      loading: current.loading,
      loaded: current.settled,
      error: current.error,
      ensure,
      refresh,
      revalidate,
      setData,
    }),
    [current.data, current.loading, current.settled, current.error, ensure, refresh, revalidate, setData],
  );
}

/** Widget si zdroj aktivuje pri mounte (načíta sa, ak treba). */
export function useEnsure(...resources: Array<{ ensure: () => void } | null | undefined>) {
  useEffect(() => {
    resources.forEach((r) => r?.ensure());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resources.map((r) => r?.ensure));
}
