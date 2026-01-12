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
          // ak nič v DB, zapíš defaulty
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

  const inputBase =
    "mt-1 block w-full rounded-md border border-white/15 bg-black/20 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/70";

  return (
    <section className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Personal settings</h2>
          <p className="mt-1 text-xs opacity-70">
            Jazyk, jednotky, formát dátumu a času. Platí pre celé rozhranie.
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
        <div>
          <label className="text-xs opacity-80">Jazyk rozhrania</label>
          <select
            className={inputBase}
            value={settings.language}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                language: (e.target.value as "sk" | "en") || "sk",
              }))
            }
          >
            <option value="sk">Slovenčina</option>
            <option value="en">English</option>
          </select>
        </div>

        <div>
          <label className="text-xs opacity-80">Jednotky</label>
          <select
            className={inputBase}
            value={settings.units}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                units: (e.target.value as "metric" | "imperial") || "metric",
              }))
            }
          >
            <option value="metric">Metrické (km, kg)</option>
            <option value="imperial">Imperiálne (mi, lb)</option>
          </select>
        </div>

        <div>
          <label className="text-xs opacity-80">Timezone (IANA)</label>
          <input
            className={inputBase}
            type="text"
            placeholder="Europe/Bratislava"
            value={settings.timezone}
            onChange={(e) =>
              setSettings((s) => ({ ...s, timezone: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="text-xs opacity-80">Začiatok týždňa</label>
          <select
            className={inputBase}
            value={settings.week_start}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                week_start: (e.target.value as "Mon" | "Sun") || "Mon",
              }))
            }
          >
            <option value="Mon">Pondelok</option>
            <option value="Sun">Nedeľa</option>
          </select>
        </div>

        <div>
          <label className="text-xs opacity-80">Formát dátumu</label>
          <input
            className={inputBase}
            type="text"
            placeholder="yyyy-MM-dd"
            value={settings.date_format}
            onChange={(e) =>
              setSettings((s) => ({ ...s, date_format: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="text-xs opacity-80">Formát času</label>
          <select
            className={inputBase}
            value={settings.time_format_24h ? "24" : "12"}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                time_format_24h: e.target.value === "24",
              }))
            }
          >
            <option value="24">24 h (13:37)</option>
            <option value="12">12 h (1:37 PM)</option>
          </select>
        </div>
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