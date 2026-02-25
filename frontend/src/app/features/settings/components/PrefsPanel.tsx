"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import SelectField from "@/app/shared/ui/components/SelectField";
import { toast } from "@/app/shared/ui/components/Toast";

import type { UserSettings } from "@/app/features/settings/types/account";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  FORM_GRID_TWO,
  PANEL_STACK,
  INPUTS_CARD_BODY,
  INPUTS_CARD_SAVE_BTN,
} from "@/app/shared/ui/tokens";

const DEFAULT_SETTINGS: UserSettings = {
  units: "metric",
  language: "sk",
  timezone: "Europe/Bratislava",
  week_start: "Mon",
  date_format: "yyyy-MM-dd",
  time_format_24h: true,
};

const LANGUAGES = ["sk", "en"];
const UNITS = ["metric", "imperial"];
const WEEK_STARTS = ["Mon", "Sun"];
const TIME_FORMATS = ["24", "12"];
const TIMEZONES = [
  "UTC",
  "Atlantic/Canary",
  "Europe/Bratislava",
  "Europe/Vienna",
  "Europe/Paris",
  "Europe/Athens",
  "Europe/Helsinki",
  "Africa/Cairo",
  "Europe/Moscow",
  "Asia/Riyadh",
  "America/Sao_Paulo",
  "America/Halifax",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function PrefsPanel() {
  const { userId } = useUserId();
  const t = useT();

  const [open, setOpen] = useState(true);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const LANGUAGE_OPTIONS = useMemo(
    () =>
      LANGUAGES.map((v) => ({
        value: v,
        label: t(`account.languageOptions.${v}` as any),
      })),
    [t],
  );
  const UNIT_OPTIONS = useMemo(
    () =>
      UNITS.map((v) => ({
        value: v,
        label: t(`account.unitOptions.${v}` as any),
      })),
    [t],
  );
  const WEEK_START_OPTIONS = useMemo(
    () =>
      WEEK_STARTS.map((v) => ({
        value: v,
        label: t(`account.weekStartOptions.${v}` as any),
      })),
    [t],
  );
  const TIME_FORMAT_OPTIONS = useMemo(
    () =>
      TIME_FORMATS.map((v) => ({
        value: v,
        label: t(`account.timeFormatOptions.${v}` as any),
      })),
    [t],
  );
  const TIMEZONE_OPTIONS = useMemo(
    () =>
      TIMEZONES.map((tz) => ({
        value: tz,
        label: t(`account.timezones.${tz}` as any),
      })),
    [t],
  );

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const raw = await apiFetchUserPref(userId, "user.settings").catch(
          () => null,
        );
        if (!alive) return;
        if (raw && typeof raw === "object") {
          setSettings((prev) => ({
            ...prev,
            ...(raw as Partial<UserSettings>),
          }));
        } else {
          await apiUpsertUserPref(userId, "user.settings", DEFAULT_SETTINGS);
          setSettings(DEFAULT_SETTINGS);
        }
      } catch (e) {
        console.error("[PrefsPanel] load error", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    try {
      await apiUpsertUserPref(userId, "user.settings", settings);
      toast.success(t("api.common.saveSuccess"));
      setOpen(false);
    } catch (e: any) {
      console.error("[PrefsPanel] save error", e);
      toast.error(t("api.common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const previewText = useMemo(() => {
    const lang = settings.language === "sk" ? "SK" : "EN";
    const units = settings.units === "metric" ? "metric" : "imperial";
    const wk = settings.week_start;
    const tf = settings.time_format_24h ? "24h" : "12h";
    const tz = settings.timezone || "—";
    return `${lang} • ${units} • ${tz} • ${t("settings.preview.week")} ${wk} • ${tf}`;
  }, [settings, t]);

  const disabled = !userId || loading || saving;

  return (
    <InputsCard
      title={t("settings.prefs.title")}
      subtitle={t("settings.prefs.subtitle")}
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
      actions={
        <Button
          size="sm"
          variant="primary"
          disabled={disabled}
          onClick={handleSave}
          className={INPUTS_CARD_SAVE_BTN}
        >
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      }
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className={FORM_GRID_TWO}>
          <SelectField
            label={t("settings.prefs.labels.language")}
            variant="editable"
            value={settings.language}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                language: (e.target.value as "sk" | "en") || "sk",
              }))
            }
            options={LANGUAGE_OPTIONS}
          />
          <SelectField
            label={t("settings.prefs.labels.units")}
            variant="readonly"
            value={settings.units}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                units: (e.target.value as "metric" | "imperial") || "metric",
              }))
            }
            options={UNIT_OPTIONS}
          />
          <SelectField
            label={t("settings.prefs.labels.timezone")}
            hint={t("settings.prefs.labels.timezoneHint")}
            variant="readonly"
            value={settings.timezone}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                timezone: e.target.value || "Europe/Bratislava",
              }))
            }
            options={TIMEZONE_OPTIONS}
          />
          <SelectField
            label={t("settings.prefs.labels.weekStart")}
            variant="readonly"
            value={settings.week_start}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                week_start: (e.target.value as "Mon" | "Sun") || "Mon",
              }))
            }
            options={WEEK_START_OPTIONS}
          />
          <div>
            <div
              className="text-xs font-medium"
              style={{ color: appColors.textMuted }}
            >
              {t("settings.dateFormat")}
            </div>
            <div className="mt-1">
              <TextField
                variant="readonly"
                type="text"
                value={settings.date_format}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, date_format: e.target.value }))
                }
                placeholder="yyyy-MM-dd"
                disabled={disabled}
              />
            </div>
          </div>
          <SelectField
            label={t("settings.prefs.labels.timeFormat")}
            variant="readonly"
            value={settings.time_format_24h ? "24" : "12"}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                time_format_24h: e.target.value === "24",
              }))
            }
            options={TIME_FORMAT_OPTIONS}
          />
        </div>
      </div>
    </InputsCard>
  );
}
