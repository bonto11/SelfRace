"use client";

import { useEffect, useState } from "react";

import Button from "@/app/shared/ui/components/Button";
import IconWatch from "@/app/shared/svg/Watch";
import { toast } from "@/app/shared/ui/components/Toast";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import {
  apiIntervalsStatus,
  apiIntervalsSync,
} from "@/app/features/recovery/api/intervals";

/**
 * Ručný sync recovery z intervals.icu. Zobrazí sa len userom, ktorí majú
 * riadok v intervals_accounts – ostatní o integrácii nevedia.
 */
export default function IntervalsSyncButton() {
  const t = useT();
  const { userId } = useUserId();
  const { refresh } = useRecoveryData();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiIntervalsStatus(Number(userId)).then((v) => {
      if (alive) setEnabled(v);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!enabled || !userId) return null;

  const onClick = async () => {
    setBusy(true);
    try {
      const res = await apiIntervalsSync(Number(userId));
      if (res.ok) {
        toast.success(t("recovery.intervals.syncSuccess"));
        await refresh(true);
      } else {
        toast.error(t(`recovery.intervals.errors.${res.errorCode}` as any));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      circle
      size="sm"
      variant="ghost"
      aria-label={t("recovery.intervals.syncTitle")}
      title={t("recovery.intervals.syncTitle")}
      onClick={onClick}
      disabled={busy}
    >
      <IconWatch className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} />
    </Button>
  );
}
