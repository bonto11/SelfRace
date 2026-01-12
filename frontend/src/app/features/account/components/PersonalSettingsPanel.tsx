"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";
import Button from "@/app/shared/components/ui/Button";
import { toast } from "@/app/shared/components/ui/Toast";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/app/shared/ui/classes";

/* ─────────────────────── types & defaults ─────────────────────── */

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

/* ─────────────────────── timezones ─────────────────────── */

type TzOption = { value: string; label: string };
type TzGroup = { label: string; options: TzOption[] };

const TIMEZONE_GROUPS: TzGroup[] = [
  {
    label: "UTC−8",
    options: [
      { value: "America/Los_Angeles", label: "Pacific — Los Angeles, Vancouver" },
      { value: "America/Vancouver", label: "Vancouver" },
    ],
  },
  {
    label: "UTC−5",
    options: [
      { value: "America/New_York", label: "Eastern — New York, Toronto" },
      { value: "America/Toronto", label: "Toronto" },
      { value: "America/Bogota", label: "Bogotá" },
    ],
  },
  {
    label: "UTC−3",
    options: [
      { value: "America/Sao_Paulo", label: "São Paulo" },
      { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
    ],
  },
  {
    label: "UTC±0",
    options: [
      { value: "Europe/London", label: "London" },
      { value: "Atlantic/Canary", label: "Canary Islands" },
      { value: "UTC", label: "UTC" },
    ],
  },
  {
    label: "UTC+1",
    options: [
      {
        value: "Europe/Bratislava",
        label: "Bratislava, Vienna, Prague",
      },
      { value: "Europe/Berlin", label: "Berlin" },
      { value: "Europe/Paris", label: "Paris" },
      { value: "Europe/Oslo", label: "Oslo" },
    ],
  },
  {
    label: "UTC+2",
    options: [
      { value: "Europe/Athens", label: "Athens" },
      { value: "Europe/Bucharest", label: "Bucharest" },
      { value: "Europe/Helsinki", label: "Helsinki" },
      { value: "Africa/Cairo", label: "Cairo" },
    ],
  },
  {
    label: "UTC+3",
    options: [
      { value: "Europe/Moscow", label: "Moscow" },
      { value: "Asia/Riyadh", label: "Riyadh" },
      { value: "Africa/Nairobi", label: "Nairobi" },
    ],
  },
  {
    label: "UTC+4",
    options: [
      { value: "Asia/Dubai", label: "Dubai" },
      { value: "Asia/Baku", label: "Baku" },
    ],
  },
  {
    label: "UTC+5",
    options: [
      { value: "Asia/Tashkent", label: "Tashkent" },
      { value: "Asia/Karachi", label: "Karachi" },
    ],
  },
  {
    label: "UTC+5:30",
    options: [{ value: "Asia/Kolkata", label: "India — Kolkata, Delhi" }],
  },
  {
    label: "UTC+6",
    options: [
      { value: "Asia/Dhaka", label: "Dhaka" },
      { value: "Asia/Almaty", label: "Almaty" },
    ],
  },
  {
    label: "UTC+7",
    options: [
      { value: "Asia/Bangkok", label: "Bangkok" },
      { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh City" },
    ],
  },
  {
    label: "UTC+8",
    options: [
      { value: "Asia/Shanghai", label: "Shanghai" },
      { value: "Asia/Singapore", label: "Singapore" },
      { value: "Asia/Hong_Kong", label: "Hong Kong" },
      { value: "Australia/Perth", label: "Perth" },
    ],
  },
  {
    label: "UTC+9",
    options: [
      { value: "Asia/Tokyo", label: "Tokyo" },
      { value: "Asia/Seoul", label: "Seoul" },
    ],
  },
  {
    label: "UTC+10",
    options: [
      { value: "Australia/Sydney", label: "Sydney" },
      { value: "Pacific/Port_Moresby", label: "Port Moresby" },
    ],
  },
  {
    label: "UTC+12",
    options: [
      { value: "Pacific/Auckland", label: "Auckland" },
      { value: "Pacific/Fiji", label: "Fiji" },
    ],
  },
];

const TIMEZONE_FLAT: TzOption[] = TIMEZONE_GROUPS.flatMap((g) => g.options);

/* ─────────────────────── component ─────────────────────── */

export default function PersonalSettingsPanel() {
  const router = useRouter();
  const { userId } = useUserId();

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(true);

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

  // ak máš v settings timezone, ktorý nie je v našom zozname, zobrazíme Bratislavu
  const timezoneValue = useMemo(() => {
    const found = TIMEZONE_FLAT.some((o) => o.value === settings.timezone);
    return found ? settings.timezone : DEFAULT_SETTINGS.timezone;
  }, [settings.timezone]);

  const previewText = useMemo(() => {
    const lang = settings.language === "sk" ? "SK" : "EN";
    const units = settings.units === "metric" ? "metric" : "imperial";
    const timeFmt = settings.time_format_24h ? "24h" : "12h";
    const tzLabel =
      TIMEZONE_FLAT.find((o) => o.value === timezoneValue)?.label ??
      timezoneValue;

    return `Lang: ${lang} | Units: ${units} | TZ: ${tzLabel} | Time: ${timeFmt}`;
  }, [settings.language, settings.units, settings.time_format_24h, timezoneValue]);

  return (
    <section className={SECTION}>
      {/* header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col">
          <div className="text-sm font-medium opacity-90">
            Personal settings
          </div>
          <div className="text-xs opacity-70">
            Language, units, date & time format pre celé rozhranie.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="primary"
            disabled={disabled}
            onClick={handleSave}
          >
            {saving ? "Ukladám…" : "Uložiť"}
          </Button>

          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((v) => !v)}
            labelWhenOpen="Collapse personal settings"
            labelWhenClosed="Expand personal settings"
          />
        </div>
      </div>

      {/* closed preview */}
      {!open && (
        <div
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs opacity-70 select-none",
          ].join(" ")}
        >
          {previewText}
        </div>
      )}

      {open && (
        <div className="space-y-4">
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
                    units:
                      (e.target.value as "metric" | "imperial") || "metric",
                  }))
                }
              >
                <option value="metric">Metrické (km, kg)</option>
                <option value="imperial">Imperiálne (mi, lb)</option>
              </select>
            </div>

            <div>
              <label className="text-xs opacity-80">Timezone</label>
              <select
                className={inputBase}
                value={timezoneValue}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    timezone: e.target.value,
                  }))
                }
              >
                {TIMEZONE_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
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
                  setSettings((s) => ({
                    ...s,
                    date_format: e.target.value,
                  }))
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
            <h3 className="text-sm font-semibold opacity-90">
              Account actions
            </h3>
            <p className="text-xs opacity-70">
              Rýchle akcie pre zmenu hesla a e-mailu (otvoria samostatnú
              stránku).
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
        </div>
      )}
    </section>
  );
}