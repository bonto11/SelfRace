"use client";

import { useEffect } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";

export default function UserSettingsBootstrapper() {
  const { userId } = useUserId();
  const { attachUser, detachUser } = useSettings();

  useEffect(() => {
    if (!userId) {
      detachUser();
      return;
    }
    void attachUser(userId);
  }, [userId, attachUser, detachUser]);

  return null;
}