"use client";

import { useEffect } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useSettings } from "./SettingsProvider";

export default function SettingsDbBootstrapper() {
  const { userId } = useUserId();
  const { bindUser, syncFromDb } = useSettings();

  useEffect(() => {
    bindUser(userId ?? null);
    if (!userId) return;
    void syncFromDb(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return null;
}