// src/app/features/account/components/SettingsInputs.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiFetchUserPref, apiUpsertUserPref } from "@/app/features/prefs/api/prefs";

import InputsCard from "@/app/shared/components/ui/InputsCard";
import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import SelectField from "@/app/shared/components/ui/SelectField";
import { toast } from "@/app/shared/components/ui/Toast";
import { confirm } from "@/app/shared/components/ui/Confirm";

import {
  apiGetAccountDeleteStatus,
  apiRequestAccountDelete,
  apiCancelAccountDelete,
} from "@/app/features/account/api/accountDelete";

import type { UserSettings, AccountDeleteStatus } from "@/app/features/account/types/account";
import { appColors } from "@/app/shared/theme/app_colors";

import {
  FORM_GRID_TWO,
  FORM_GRID_SPLIT,
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

const LANGUAGE_OPTIONS = [
  { value: "sk", label: "Slovenčina" },
  { value: "en", label: "Angličtina" },
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

// kurátorovaný zoznam – IANA názvy, v labeloch offset + mestá
const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "(UTC±00:00) Londýn, Reykjavík" },
  { value: "Atlantic/Canary", label: "(UTC±00:00) Kanárske ostrovy" },

  { value: "Europe/Bratislava", label: "(UTC+01:00) Bratislava, Praha, Berlín" },
  { value: "Europe/Vienna", label: "(UTC+01:00) Viedeň, Budapešť, Varšava" },
  { value: "Europe/Paris", label: "(UTC+01:00) Paríž, Madrid, Rím" },

  { value: "Europe/Athens", label: "(UTC+02:00) Atény, Bukurešť" },
  { value: "Europe/Helsinki", label: "(UTC+02:00) Helsinki, Riga" },
  { value: "Africa/Cairo", label: "(UTC+02:00) Káhira" },

  { value: "Europe/Moscow", label: "(UTC+03:00) Moskva" },
  { value: "Asia/Riyadh", label: "(UTC+03:00) Rijád" },

  { value: "America/Sao_Paulo", label: "(UTC−03:00) São Paulo" },
  { value: "America/Halifax", label: "(UTC−04:00) Halifax" },
  { value: "America/New_York", label: "(UTC−05:00) New York" },
  { value: "America/Chicago", label: "(UTC−06:00) Chicago" },
  { value: "America/Denver", label: "(UTC−07:00) Denver" },
  { value: "America/Los_Angeles", label: "(UTC−08:00) Los Angeles" },

  { value: "Asia/Dubai", label: "(UTC+04:00) Dubaj" },
  { value: "Asia/Karachi", label: "(UTC+05:00) Karáčí" },
  { value: "Asia/Kolkata", label: "(UTC+05:30) India (Kolkata)" },
  { value: "Asia/Bangkok", label: "(UTC+07:00) Bangkok" },
  { value: "Asia/Shanghai", label: "(UTC+08:00) Šanghaj, Hong Kong" },
  { value: "Asia/Tokyo", label: "(UTC+09:00) Tokio, Soul" },
  { value: "Australia/Sydney", label: "(UTC+10:00) Sydney" },
];

export default function SettingsInputs() {
  const router = useRouter();
  const { userId } = useUserId();

  const [open, setOpen] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deleteStatus, setDeleteStatus] = useState<AccountDeleteStatus | null>(null);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [processingDelete, setProcessingDelete] = useState(false);

  // load user.settings
  useEffect(() => {
    if (!userId) return;

    let alive = true;

    (async () => {
      try {
        const raw = await apiFetchUserPref(userId, "user.settings").catch(() => null);

        if (!alive) return;

        if (raw && typeof raw === "object") {
          setSettings((prev) => ({ ...prev, ...(raw as Partial<UserSettings>) }));
        } else {
          await apiUpsertUserPref(userId, "user.settings", DEFAULT_SETTINGS);
          setSettings(DEFAULT_SETTINGS);
        }
      } catch (e) {
        console.error("[SettingsInputs] load error", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  // load delete status
  useEffect(() => {
    if (!userId) {
      setDeleteStatus(null);
      return;
    }

    let alive = true;
    setLoadingDelete(true);

    apiGetAccountDeleteStatus(userId)
      .then((st) => {
        if (!alive) return;
        setDeleteStatus(st);
      })
      .catch((e) => console.error("[SettingsInputs] delete status error", e))
      .finally(() => {
        if (alive) setLoadingDelete(false);
      });

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
      setOpen(false);
    } catch (e: any) {
      console.error("[SettingsInputs] save error", e);
      toast.error(e?.message || "Nepodarilo sa uložiť nastavenia.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestDelete() {
    if (!userId || processingDelete) return;

    const first = await confirm({
      title: "Zrušiť účet?",
      message:
        "Účet nebude hneď vymazaný. Najprv sa označí na zmazanie a po 30 dňoch sa všetky tvoje dáta z aplikácie odstránia.",
      okText: "Pokračovať",
      cancelText: "Zrušiť",
    });
    if (!first) return;

    const second = await confirm({
      title: "Naozaj chceš zrušiť účet?",
      message:
        "Toto je nezvratná akcia. Po 30 dňoch sa trvalo vymažú tréningy, plány aj prepojenia (napr. Strava). Do tej doby môžeš zrušenie ešte odvolať.",
      okText: "Áno, označiť na zmazanie",
      cancelText: "Nechcem mazať",
      tone: "danger",
    });
    if (!second) return;

    setProcessingDelete(true);
    try {
      const st = await apiRequestAccountDelete(userId);
      setDeleteStatus(st);
      toast.success("Účet je označený na zmazanie. Po 30 dňoch sa dáta odstránia.");
    } catch (e: any) {
      console.error("[SettingsInputs] delete request error", e);
      toast.error(e?.message || "Nepodarilo sa označiť účet na zmazanie.");
    } finally {
      setProcessingDelete(false);
    }
  }

  async function handleCancelDelete() {
    if (!userId || processingDelete) return;

    const ok = await confirm({
      title: "Zrušiť plánované zmazanie účtu?",
      message: "Ak zrušíš plánované zmazanie, účet ostane aktívny a dáta sa nevymažú.",
      okText: "Áno, ponechať účet",
      cancelText: "Nechať zmazanie",
    });
    if (!ok) return;

    setProcessingDelete(true);
    try {
      const st = await apiCancelAccountDelete(userId);
      setDeleteStatus(st);
      toast.success("Plánované zmazanie účtu bolo zrušené.");
    } catch (e: any) {
      console.error("[SettingsInputs] cancel delete error", e);
      toast.error(e?.message || "Nepodarilo sa zrušiť plánované zmazanie.");
    } finally {
      setProcessingDelete(false);
    }
  }

  const disabled = !userId || loading || saving;

  const deletePending = !!deleteStatus?.pending;
  const deleteAtLabel =
    deleteStatus?.delete_at &&
    (() => {
      try {
        return new Date(deleteStatus.delete_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch {
        return deleteStatus.delete_at;
      }
    })();

  const previewText = useMemo(() => {
    const lang = settings.language === "sk" ? "SK" : "EN";
    const units = settings.units === "metric" ? "metric" : "imperial";
    const wk = settings.week_start;
    const tf = settings.time_format_24h ? "24h" : "12h";
    const tz = settings.timezone || "—";
    const del = loadingDelete ? "delete: …" : deletePending ? `delete: ${deleteAtLabel ?? "pending"}` : "delete: —";
    return `${lang} • ${units} • ${tz} • week ${wk} • ${tf} • ${del}`;
  }, [
    settings.language,
    settings.units,
    settings.timezone,
    settings.week_start,
    settings.time_format_24h,
    loadingDelete,
    deletePending,
    deleteAtLabel,
  ]);

  return (
    <InputsCard
      title="Osobné nastavenia"
      subtitle="Jazyk, jednotky, časové pásmo a formát dátumu/času pre celé rozhranie."
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
      actions={
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={handleSave}
          className={INPUTS_CARD_SAVE_BTN}
        >
          {saving ? "Ukladám…" : "Uložiť"}
        </Button>
      }
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* Preferencie */}
        <div className={FORM_GRID_TWO}>
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
            label="Časové pásmo"
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
            <div className="text-xs font-medium" style={{ color: appColors.textMuted }}>
              Formát dátumu
            </div>
            <div className="mt-1">
              <TextField
                type="text"
                value={settings.date_format}
                onChange={(e) => setSettings((s) => ({ ...s, date_format: e.target.value }))}
                placeholder="yyyy-MM-dd"
                disabled={disabled}
              />
            </div>
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

        {/* Účet – akcie */}
        <div className="mt-4 pt-3 border-t" style={{ borderColor: appColors.divider }}>
          <div className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
            Akcie účtu
          </div>
          <p className="text-xs mt-1" style={{ color: appColors.textMuted }}>
            Rýchle akcie pre zmenu hesla a profilu (otvoria samostatnú stránku).
          </p>

          <div className={["mt-2", FORM_GRID_SPLIT].join(" ")}>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => router.push("/forgot-password")}
              disabled={!userId}
            >
              Zmeniť heslo (e-mailom)
            </Button>

            <Button
              size="xs"
              variant="secondary"
              onClick={() => router.push("/profile")}
              disabled={!userId}
            >
              Zmeniť e-mail / profil
            </Button>
          </div>
        </div>

        {/* Zrušenie účtu */}
        <div className="mt-4 pt-3 border-t" style={{ borderColor: appColors.divider }}>
          <div className="text-sm font-semibold" style={{ color: appColors.statusError }}>
            Zrušenie účtu (nezvratné)
          </div>

          <div
            className="mt-2 rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor: "rgba(239,68,68,0.55)",
              background: "rgba(127,29,29,0.35)",
              color: appColors.textPrimary,
            }}
          >
            {loadingDelete ? (
              <p style={{ color: appColors.textMuted }}>Kontrolujem stav zmazania účtu…</p>
            ) : deletePending ? (
              <>
                <p>
                  Účet je <span className="font-semibold">označený na zmazanie</span>.
                </p>
                <p className="mt-1" style={{ color: appColors.textMuted }}>
                  Ak nič neurobíš, dáta (tréningy, plány, prepojenia so Stravou) sa po 30 dňoch trvalo
                  vymažú.
                  {deleteAtLabel ? (
                    <>
                      {" "}
                      Odhadovaný dátum zmazania:{" "}
                      <span className="font-semibold" style={{ color: appColors.textPrimary }}>
                        {deleteAtLabel}
                      </span>
                      .
                    </>
                  ) : (
                    "."
                  )}
                </p>
              </>
            ) : (
              <>
                <p>
                  Zmazanie účtu je <span className="font-semibold">nezvratné</span>.
                </p>
                <p className="mt-1" style={{ color: appColors.textMuted }}>
                  Najprv sa účet označí na zmazanie. Počas nasledujúcich 30 dní ho môžeš ešte zachrániť,
                  potom sa všetky dáta odstránia.
                </p>
              </>
            )}
          </div>

          <div className="mt-2">
            {deletePending ? (
              <Button
                size="xs"
                variant="secondary"
                disabled={processingDelete || !userId}
                onClick={handleCancelDelete}
              >
                {processingDelete ? "Ruším plánované zmazanie…" : "Zrušiť plánované zmazanie"}
              </Button>
            ) : (
              <Button
                size="xs"
                variant="secondary"
                disabled={processingDelete || !userId}
                onClick={handleRequestDelete}
              >
                {processingDelete ? "Označujem na zmazanie…" : "Označiť účet na zmazanie"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </InputsCard>
  );
}