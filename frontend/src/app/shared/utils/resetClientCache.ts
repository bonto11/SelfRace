// src/shared/utils/resetClientCache.ts
export function resetClientCache() {
  if (typeof window === "undefined") return;

  const LS_KEYS = [
    "coach.generated",
    "coach.prefs",
    "up:coach.prefs",
    // ak máš ešte niečo vlastné, dopíš sem
  ];

  try {
    LS_KEYS.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }

  try {
    // ak používaš sessionStorage pre niečo coach-related, môžeš vyčistiť všetko
    window.sessionStorage.clear();
  } catch {
    // ignore
  }

  // full reload – všetky providery sa znova mountnú a fetchnú z DB
  window.location.reload();
}