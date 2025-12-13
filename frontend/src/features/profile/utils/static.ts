// src/features/profile/utils/static.ts
import type { StaticProfile } from "@/features/profile/types/staticTypes";

export function summarizeStaticProfile(profile: StaticProfile | null) {
  const p: StaticProfile = profile ?? {
    sex: null,
    birth_date: null,
    height_cm: null,
  };

  const sex = p.sex || "—";
  const bd = p.birth_date || "—";
  const h = Number.isFinite(p.height_cm as number)
    ? `${p.height_cm} cm`
    : "—";

  return { sex, bd, h };
}