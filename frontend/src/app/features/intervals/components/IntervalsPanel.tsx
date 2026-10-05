"use client";

import { useEffect, useState } from "react";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import Switch from "@/app/shared/ui/components/Switch";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { parseAndFormatPrettyDate } from "@/app/shared/utils/time";
import ConnectedAppCard from "@/app/features/connectedApps/components/ConnectedAppCard";
import {
  apiIntervalsConnect,
  apiIntervalsDisconnect,
  apiIntervalsStatus,
  apiIntervalsSync,
  type IntervalsStatus,
} from "@/app/features/intervals/api/intervals";

const INTERVALS_SETTINGS_URL = "https://intervals.icu/settings";

type Busy = "connect" | "disconnect" | "sync" | null;

/**
 * intervals.icu – user zadá athlete ID a osobný API kľúč, BE ich overí
 * skúšobným dopytom a uloží (intervals_accounts). Odpojenie riadok zmaže.
 */
export default function IntervalsPanel() {
  const t = useT();
  const { userId } = useUserId();

  const [status, setStatus] = useState<IntervalsStatus | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [athleteId, setAthleteId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<Busy>(null);

  const reload = async (uid: number) => setStatus(await apiIntervalsStatus(uid));

  useEffect(() => {
    if (userId) void reload(Number(userId));
  }, [userId]);

  const connected = !!status?.connected;
  const errorText = (code: string) => t(`intervals.errors.${code}` as any);

  const onSwitch = async (next: boolean) => {
    if (!userId || busy) return;
    if (!connected) {
      // Zapnutie len otvorí formulár – pripojí sa až po overení údajov.
      setFormOpen(next);
      return;
    }
    if (next) return;

    const ok = await confirm({
      title: t("intervals.disconnect.title"),
      message: t("intervals.disconnect.message"),
      okText: t("intervals.disconnect.ok"),
      cancelText: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;

    setBusy("disconnect");
    try {
      const res = await apiIntervalsDisconnect(Number(userId));
      if (!res.ok) return void toast.error(errorText(res.errorCode));
      toast.success(t("intervals.toasts.disconnected"));
      setFormOpen(false);
      await reload(Number(userId));
    } finally {
      setBusy(null);
    }
  };

  const onConnect = async () => {
    if (!userId || busy) return;
    if (!athleteId.trim() || !apiKey.trim()) {
      return void toast.error(t("intervals.errors.intervals_missing_fields"));
    }
    setBusy("connect");
    try {
      const res = await apiIntervalsConnect(Number(userId), athleteId, apiKey);
      if (!res.ok) return void toast.error(errorText(res.errorCode));
      toast.success(t("intervals.toasts.connected"));
      setApiKey("");
      setFormOpen(false);
      await reload(Number(userId));
    } finally {
      setBusy(null);
    }
  };

  const onSync = async () => {
    if (!userId || busy) return;
    setBusy("sync");
    try {
      const res = await apiIntervalsSync(Number(userId), 7);
      if (!res.ok) return void toast.error(errorText(res.errorCode));
      toast.success(t("intervals.toasts.synced"));
      await reload(Number(userId));
    } finally {
      setBusy(null);
    }
  };

  const muted = { color: appColors.textMuted };

  return (
    <ConnectedAppCard
      title="intervals.icu"
      subtitle={t("intervals.subtitle")}
      right={
        busy === "disconnect" ? (
          <LoadingSpinner size="button" />
        ) : (
          <Switch
            checked={connected || formOpen}
            onChange={onSwitch}
            disabled={!userId || status === null || busy !== null}
            ariaLabel={t("intervals.switchLabel")}
          />
        )
      }
    >
      {connected ? (
        <div className="space-y-3">
          <div className="text-xs space-y-1" style={muted}>
            <div>
              {t("intervals.athleteIdLabel")}:{" "}
              <span style={{ color: appColors.textSecondary }}>{status?.athleteId}</span>
            </div>
            <div>
              {t("intervals.lastSync")}:{" "}
              <span style={{ color: appColors.textSecondary }}>
                {parseAndFormatPrettyDate(status?.lastSyncedAt ?? null)}
              </span>
            </div>
            {status?.hasError ? (
              <div style={{ color: appColors.statusWarning }}>{t("intervals.lastSyncError")}</div>
            ) : null}
          </div>
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={onSync}>
            {busy === "sync" ? (
              <span className="inline-flex items-center gap-1">
                <LoadingSpinner size="button" />
                {t("intervals.syncLoading")}
              </span>
            ) : (
              t("intervals.syncNow")
            )}
          </Button>
        </div>
      ) : formOpen ? (
        <div className="space-y-3">
          <ol className="list-decimal pl-5 text-xs space-y-1 leading-relaxed" style={muted}>
            <li>{t("intervals.steps.connectWatch")}</li>
            <li>{t("intervals.steps.findKey")}</li>
            <li>{t("intervals.steps.paste")}</li>
          </ol>
          <a
            href={INTERVALS_SETTINGS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
            style={{ color: appColors.textSecondary }}
          >
            {t("intervals.openSettings")}
          </a>
          <TextField
            label={t("intervals.athleteIdLabel")}
            placeholder="i123456"
            value={athleteId}
            onChange={(e) => setAthleteId(e.currentTarget.value)}
            autoComplete="off"
          />
          <TextField
            label={t("intervals.apiKeyLabel")}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.currentTarget.value)}
            autoComplete="off"
          />
          <p className="text-[11px]" style={muted}>
            {t("intervals.privacyNote")}
          </p>
          <Button size="sm" variant="primary" disabled={busy !== null} onClick={onConnect}>
            {busy === "connect" ? (
              <span className="inline-flex items-center gap-1">
                <LoadingSpinner size="button" />
                {t("intervals.connectLoading")}
              </span>
            ) : (
              t("intervals.connect")
            )}
          </Button>
        </div>
      ) : null}
    </ConnectedAppCard>
  );
}
