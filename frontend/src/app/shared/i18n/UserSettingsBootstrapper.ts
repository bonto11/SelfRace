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
  }, [userId, bindUser, syncFromDb]);

  return null;
}