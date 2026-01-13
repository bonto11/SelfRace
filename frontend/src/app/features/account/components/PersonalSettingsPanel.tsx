// src/features/account/components/PersonalSettingsPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";
import Button from "@/app/shared/components/ui/Button";
import { toast } from "@/app/shared/components/ui/Toast";
import SelectField from "@/app/shared/components/ui/SelectField";
import { inputClass } from "@/app/shared/ui";

type UserSettings = {
  units: "metric" | "imperial";
  language: "sk" | "en";
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

const LANGUAGE_OPTIONS = [
  { value: "sk", label: "Slovenčina" },
  { value: "en", label: "English" },
];

const UNIT_OPTIONS = [
  { value: "metric", label: "Metrické (km, kg)" },
  { value: "imperial", label: "Imperiálne (mi, lb)" },
];

const WEEK_START_OPTIONS = [
  { value: "Mon", label: "Pondelok" },
  { value: "Sun", label: "Nedeľa" },
];

const TIME_FORMAT_OPTIONS = [
  { value: "24", label: "24 h (13:37)" },
  { value: "12", label: "12 h (1:37 PM)" },
];

// kurátorovaný zoznam – reálne IANA názvy, v labeloch offset + mestá
const TIMEZONE_OPTIONS = [
  // západ
  { value: "UTC", label: "(UTC±00:00) London, Reykjavik" },
  { value: "Atlantic/Canary", label: "(UTC±00:00) Canary Islands" },

  // +1
  {
    value: "Europe/Bratislava",
    label: "(UTC+01:00) Bratislava, Prague, Berlin",
  },
  {
    value: "Europe/Vienna",
    label: "(UTC+01:00) Vienna, Budapest, Warsaw",
  },
  {
    value: "Europe/Paris",
    label: "(UTC+01:00) Paris, Madrid, Rome",
  },

  // +2
  { value: "Europe/Athens", label: "(UTC+02:00) Athens, Bucharest" },
  { value: "Europe/Helsinki", label: "(UTC+02:00) Helsinki, Riga" },
  { value: "Africa/Cairo", label: "(UTC+02:00) Cairo" },

  // +3
  { value: "Europe/Moscow", label: "(UTC+03:00) Moscow" },
  { value: "Asia/Riyadh", label: "(UTC+03:00) Riyadh" },

  // -3 / -4 / -5 ...
  { value: "America/Sao_Paulo", label: "(UTC−03:00) São Paulo" },
  { value: "America/Halifax", label: "(UTC−04:00) Halifax" },
  { value: "America/New_York", label: "(UTC−05:00) New York" },
  { value: "America/Chicago", label: "(UTC−06:00) Chicago" },
  { value: "America/Denver", label: "(UTC−07:00) Denver" },
  { value: "America/Los_Angeles", label: "(UTC−08:00) Los Angeles" },

  // Ázia / Pacifik
  { value: "Asia/Dubai", label: "(UTC+04:00) Dubai" },
  { value: "Asia/Karachi", label: "(UTC+05:00) Karachi" },
  { value: "Asia/Kolkata", label: "(UTC+05:30) India (Kolkata)" },
  { value: "Asia/Bangkok", label: "(UTC+07:00) Bangkok" },
  { value: "Asia/Shanghai", label: "(UTC+08:00) Shanghai, Hong Kong" },
  { value: "Asia/Tokyo", label: "(UTC+09:00) Tokyo, Seoul" },
  { value: "Australia/Sydney", label: "(UTC+10:00) Sydney" },
];

export default function PersonalSettingsPanel() {
  const router = useRouter();
  const { userId } = useUserId();

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // load user.settings
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
        console.error("[PersonalSettingsPanel] load error", e);
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
      toast.success("Nastavenia uložené.");
    } catch (e: any) {
      console.error("[PersonalSettingsPanel] save error", e);
      toast.error(e?.message || "Nepodarilo sa uložiť nastavenia.");
    } finally {
      setSaving(false);
    }
  }

  const disabled = !userId || loading || saving;

  return (
    <section className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Personal settings</h2>
          <p className="mt-1 text-xs opacity-70">
            Jazyk, jednotky, časové pásmo a formát dátumu/času pre celé
            rozhranie.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          disabled={disabled}
          onClick={handleSave}
        >
          {saving ? "Ukladám…" : "Uložiť"}
        </Button>
      </header>

      {/* APP PREFERENCIE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <SelectField
          label="Jazyk rozhrania"
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
          label="Jednotky"
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
          label="Timezone"
          hint="Vyber časové pásmo podľa mesta / offsetu."
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
          label="Začiatok týždňa"
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
          <label className="text-xs opacity-80">Formát dátumu</label>
          <input
            className={`${inputClass} mt-1`}
            type="text"
            placeholder="yyyy-MM-dd"
            value={settings.date_format}
            onChange={(e) =>
              setSettings((s) => ({ ...s, date_format: e.target.value }))
            }
          />
        </div>

        <SelectField
          label="Formát času"
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

      {/* ÚČET – heslo, e-mail */}
      <div className="pt-3 border-t border-white/10 space-y-2">
        <h3 className="text-sm font-semibold opacity-90">Account actions</h3>
        <p className="text-xs opacity-70">
          Rýchle akcie pre zmenu hesla a e-mailu (otvoria samostatnú stránku).
        </p>

        <div className="flex flex-wrap gap-2 mt-1">
          <Button
            size="xs"
            variant="secondary"
            onClick={() => router.push("/forgot-password")}
          >
            Zmeniť heslo (e-mailom)
          </Button>

          <Button
            size="xs"
            variant="secondary"
            onClick={() => router.push("/profile")}
          >
            Zmeniť e-mail / profil
          </Button>
        </div>
      </div>
    </section>
  );
}