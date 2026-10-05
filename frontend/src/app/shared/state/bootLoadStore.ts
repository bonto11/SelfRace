"use client";

/*
 * Počítadlo načítaní, na ktoré čaká úvodný splash (AppSplash).
 *
 * Provider pri fetchi, pre ktorý ešte nemá žiadne dáta (ani z cache), zavolá
 * beginBootLoad() a po dobehnutí vrátenú funkciu. Splash zmizne, keď je
 * počítadlo na nule (alebo po časovom limite). Po skončení štartu sa už nič
 * neráta - neskoršie načítania splash nikdy znovu neukážu.
 */

type Listener = () => void;

let pending = 0;
let bootDone = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

const noop = () => {};

export function beginBootLoad(): () => void {
  if (bootDone) return noop;
  pending += 1;
  emit();

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    pending = Math.max(0, pending - 1);
    emit();
  };
}

export function getBootPending(): number {
  return pending;
}

export function isBootDone(): boolean {
  return bootDone;
}

export function markBootDone() {
  if (bootDone) return;
  bootDone = true;
  pending = 0;
  emit();
}

export function subscribeBoot(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
