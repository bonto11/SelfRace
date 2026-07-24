// src/app/features/prefs/components/CoachPreferencies.tsx
"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { toast } from "@/app/shared/ui/components/Toast";
import {
  refreshCoachPrefsFromDB,
  saveCoachPrefs,
} from "@/app/features/prefs/utils/prefs";

import Button from "@/app/shared/ui/components/Button";
import { NO_X } from "@/app/shared/ui/tokens";
import {
  PANEL_STACK,
  PANEL_ACTIONS_INLINE,
} from "@/app/shared/ui/tokens/panels";

export default function CoachPreferencies() {
  const { userId } = useUserId();
  const t = useT();

  const [local, setLocal] = useState<any>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const p = await refreshCoachPrefsFromDB(userId);
        setLocal(p || {});
        setLoaded(true);
      } catch (e: any) {
        console.error("[CoachPrefs][skeleton] init error", e);
        setLoaded(true);
      }
    })();
  }, [userId]);

  const onSave = async () => {
    if (!userId) return;
    try {
      await saveCoachPrefs(userId, local);
      toast.success(t("prefs.info.saveSuccess"));
    } catch (e: any) {
      toast.error(t("api.prefs.saveFailed"));
    }
  };

  return (
    <div className={[PANEL_STACK, NO_X].join(" ")}>
      <div style={{ color: "white", padding: 12 }}>
        KOSTRA — loaded: {String(loaded)}, userId: {String(userId)}
      </div>

      <div
        className={[PANEL_ACTIONS_INLINE, "pt-4 border-t"].join(" ")}
        style={{ borderColor: "rgba(255,255,255,0.1)" }}
      >
        <Button onClick={onSave} variant="primary" className="flex-1">
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}