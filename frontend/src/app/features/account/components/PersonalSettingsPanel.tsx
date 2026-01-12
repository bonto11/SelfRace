"use client";

import { useEffect, useState } from "react";
import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import SelectField from "@/app/shared/components/ui/SelectField";
import { SECTION } from "@/app/shared/ui/classes";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";
import { toast } from "@/app/shared/components/ui/Toast";

type UserSettings = {
  units: "metric" | "imperial";
  language: string;
  timezone: string;
  week_start: "Mon" | "Sun";
  date_format: string;
  time_format_24h: boolean;
};

const DEFAULT_SETTINGS: UserSettings = {
  units: "metric",
  language: "sk",
  timezone: "Europe/Bratislava",
  week_start: "Mon",
  date_format: "yyyy-MM-dd",
  time_format_24h: true,
};

export default function PersonalSettingsPanel() {
  const { userId } = useUserId();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState<"load" | "save" | null>(null);

  // načítanie user.settings z prefs
  useEffect(() => {
    if (!userId) return;

    let alive = true;
    (async () => {
      setLoading("load");
      try {
        const pref = await apiFetchUserPref(userId, "user.settings");
        if (!alive) return;

        const merged: UserSettings = {
          ...DEFAULT_SETTINGS,
          ...(pref || {}),
        };
        setSettings(merged);
        setLoaded(merged);
      } catch (e: any) {
        console.error("[PersonalSettingsPanel] load error", e);
        toast.error(e?.message || "Nepodarilo sa načítať user settings.");
      } finally {
        if (alive) setLoading(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const dirty = JSON.stringify(settings) !== JSON.stringify(loaded);

  async function handleSave() {
    if (!userId) return;
    setLoading("save");
    try {
      await apiUpsertUserPref(userId, "user.settings", settings);
      setLoaded(settings);
      toast.success("Nastavenia uložené.");
    } catch (e: any) {
      console.error("[PersonalSettingsPanel] save error", e);
      toast.error(e?.message || "Nepodarilo sa uložiť user settings.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-sm font-semibold opacity-90">
            Personal settings
          </h2>
          <p className="mt-0.5 text-xs opacity-70">
            Základné nastavenia účtu a aplikácie.
          </p>
        </div>

        <Button
          size="xs"
          variant="primary"
          disabled={!dirty || loading === "save"}
          onClick={handleSave}
        >
          {loading === "save" ? "Ukladám…" : "Uložiť"}
        </Button>
      </div>

      {/* základné preferencie */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <SelectField
          label="Units"
          value={settings.units}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              units: (e.currentTarget.value as "metric" | "imperial") || "metric",
            }))
          }
          options={[
            { value: "metric", label: "Metric (km, kg)" },
            { value: "imperial", label: "Imperial (mi, lbs)" },
          ]}
        />

        <SelectField
          label="Language"
          value={settings.language}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              language: e.currentTarget.value || "sk",
            }))
          }
          options={[
            { value: "sk", label: "Slovenčina" },
            { value: "en", label: "English" },
          ]}
        />

        <SelectField
          label="Week start"
          value={settings.week_start}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              week_start: (e.currentTarget.value as "Mon" | "Sun") || "Mon",
            }))
          }
          options={[
            { value: "Mon", label: "Monday" },
            { value: "Sun", label: "Sunday" },
          ]}
        />

        <SelectField
          label="Time format"
          value={settings.time_format_24h ? "24" : "12"}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              time_format_24h: e.currentTarget.value === "24",
            }))
          }
          options={[
            { value: "24", label: "24-hour" },
            { value: "12", label: "12-hour (AM/PM)" },
          ]}
        />

        <TextField
          label="Timezone"
          placeholder="e.g. Europe/Bratislava"
          value={settings.timezone}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              timezone: e.currentTarget.value || "Europe/Bratislava",
            }))
          }
        />

        <TextField
          label="Date format"
          placeholder="e.g. yyyy-MM-dd"
          value={settings.date_format}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              date_format: e.currentTarget.value || "yyyy-MM-dd",
            }))
          }
        />
      </div>

      {/* akcie účtu: heslo / e-mail */}
      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="text-xs font-medium opacity-70 mb-2">
          Account actions
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              window.location.href = "/forgot-password";
            }}
          >
            Zmeniť heslo (e-mailom)
          </Button>

          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              window.location.href = "/profile";
            }}
          >
            Zmeniť e-mail / profil
          </Button>
        </div>
      </div>
    </section>
  );
}