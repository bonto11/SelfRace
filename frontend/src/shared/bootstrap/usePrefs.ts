"use client";

import { useEffect, useRef } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import { bootstrapUserPrefs } from "@/shared/bootstrap/prefs";

export default function UsePrefsBootstrapper() {
  const { userId } = useUserId();
  const ranFor = useRef<number | null>(null); // proti duplicitám v React StrictMode

  useEffect(() => {
    if (!userId) return;
    if (ranFor.current === userId) return;
    ranFor.current = userId;

    bootstrapUserPrefs(userId).catch(() => {
      // zámerne ticho – nech neblokuje UI
    });
  }, [userId]);

  return null;
}