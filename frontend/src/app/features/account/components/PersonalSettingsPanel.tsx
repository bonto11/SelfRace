"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";

import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import SelectField from "@/app/shared/components/ui/SelectField";
import { toast } from "@/app/shared/components/ui/Toast";

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

export default function PersonalSettingsPanel() {
  const router = useRouter();
  const { userId } = useUserId();

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // načítanie user.settings
  useEffect(() => {
    if (!userId) return;

    let alive = true;

    (async () => {
      try {
        const raw = await apiFetchUserPref(userId, "user.settings").catch(
          () => null
        );

        if (!alive) return;

        if (raw && typeof raw === "object") {
          setSettings((prev) => ({
            ...prev,
            ...(raw as Partial<UserSettings>),
          }));
        } else {
          // ak nič v DB, použijeme default a rovno uložíme
          await apiUpsertUserPref(userId, "user.settings", DEFAULT_SETTINGS);
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
            Jazyk, jednotky, formát dátumu a času. Tieto nastavenia platia pre
            celé rozhranie.
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField
          label="Jazyk rozhrania"
          value={settings.language}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              language: (e.currentTarget.value as "sk" | "en") || "sk",
            }))
          }
          options={[
            { value: "sk", label: "Slovenčina" },
            { value: "en", label: "English" },
          ]}
        />

        <SelectField
          label="Jednotky"
          value={settings.units}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              units: (e.currentTarget.value as "metric" | "imperial") || "metric",
            }))
          }
          options={[
            { value: "metric", label: "Metrické (km, kg)" },
            { value: "imperial", label: "Imperiálne (mi, lb)" },
          ]}
        />

        <TextField
          label="Timezone (IANA)"
          placeholder="Europe/Bratislava"
          value={settings.timezone}
          onChange={(e) =>
            setSettings((s) => ({ ...s, timezone: e.currentTarget.value }))
          }
        />

        <SelectField
          label="Začiatok týždňa"
          value={settings.week_start}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              week_start: (e.currentTarget.value as "Mon" | "Sun") || "Mon",
            }))
          }
          options={[
            { value: "Mon", label: "Pondelok" },
            { value: "Sun", label: "Nedeľa" },
          ]}
        />

        <TextField
          label="Formát dátumu"
          placeholder="yyyy-MM-dd"
          value={settings.date_format}
          onChange={(e) =>
            setSettings((s) => ({ ...s, date_format: e.currentTarget.value }))
          }
        />

        <SelectField
          label="Formát času"
          value={settings.time_format_24h ? "24" : "12"}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              time_format_24h: e.currentTarget.value === "24",
            }))
          }
          options={[
            { value: "24", label: "24 h (13:37)" },
            { value: "12", label: "12 h (1:37 PM)" },
          ]}
        />
      </div>

      {/* ÚČET – heslo, e-mail */}
      <div className="pt-3 border-t border-white/10 space-y-2">
        <h3 className="text-sm font-semibold opacity-90">
          Account actions
        </h3>
        <p className="text-xs opacity-70">
          Rýchle akcie pre zmenu hesla a e-mailu. Otvoria samostatnú stránku.
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