// src/features/account/components/PersonalSettingsPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiFetchUserPref, apiUpsertUserPref } from "@/app/features/prefs/api/prefs";

import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/CheckBox";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import SelectField from "@/app/shared/ui/components/SelectField";

import {
  apiGetAccountDeleteStatus,
  apiRequestAccountDelete,
  apiCancelAccountDelete,
} from "@/app/features/account/api/accountDelete";

import type {
  UserSettings,
  AccountDeleteStatus,
} from "@/app/features/account/types/account";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  SECTION,
  SECTION_STYLE,
  FORM_GRID_TWO,
  inputClass,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_CARD_TITLE,
  PANEL_ACTIONS_INLINE,
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

type DeleteStep = "none" | "step1" | "step2";

export default function PersonalSettingsPanel() {
  const router = useRouter();
  const { userId } = useUserId();

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deleteStatus, setDeleteStatus] = useState<AccountDeleteStatus | null>(
    null
  );
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [processingDelete, setProcessingDelete] = useState(false);

  // modal state (Strava-like)
  const [deleteStep, setDeleteStep] = useState<DeleteStep>("none");
  const [deleteConsent, setDeleteConsent] = useState(false); // checkbox inside modal

  // load user.settings
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
      .catch((e) =>
        console.error("[PersonalSettingsPanel] delete status error", e)
      )
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
    } catch (e: any) {
      console.error("[PersonalSettingsPanel] save error", e);
      toast.error(e?.message || "Nepodarilo sa uložiť nastavenia.");
    } finally {
      setSaving(false);
    }
  }

  // ===== Delete flow (Strava-like modal) =====
  function openDeleteModal() {
    if (!userId || processingDelete) return;
    setDeleteConsent(false);
    setDeleteStep("step1");
  }

  function closeDeleteModal() {
    if (processingDelete) return;
    setDeleteStep("none");
    setDeleteConsent(false);
  }

  function goDeleteStep2() {
    if (!deleteConsent) {
      toast.error("Najprv zaškrtni súhlas – bez toho nepokračujem.");
      return;
    }
    setDeleteStep("step2");
  }

  async function handleConfirmDelete() {
    if (!userId || processingDelete) return;

    // hard stop without consent
    if (!deleteConsent) {
      toast.error("Najprv zaškrtni súhlas – bez toho účet neoznačím na zmazanie.");
      return;
    }

    setProcessingDelete(true);
    try {
      const st = await apiRequestAccountDelete(userId);
      setDeleteStatus(st);

      toast.success("Účet je označený na zmazanie. Do lehoty to vieš ešte zrušiť.");
      closeDeleteModal();
    } catch (e: any) {
      console.error("[PersonalSettingsPanel] delete request error", e);
      toast.error(e?.message || "Nepodarilo sa označiť účet na zmazanie.");
    } finally {
      setProcessingDelete(false);
    }
  }

  async function handleCancelDelete() {
    if (!userId || processingDelete) return;

    setProcessingDelete(true);
    try {
      const st = await apiCancelAccountDelete(userId);
      setDeleteStatus(st);
      toast.success("Plánované zmazanie účtu bolo zrušené.");
    } catch (e: any) {
      console.error("[PersonalSettingsPanel] cancel delete error", e);
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

  return (
    <>
      <section className={SECTION} style={SECTION_STYLE}>
        {/* header */}
        <div className={PANEL_SECTION_HEAD}>
          <div className="min-w-0">
            <div
              className={PANEL_SECTION_TITLE}
              style={{ color: appColors.textPrimary }}
            >
              Osobné nastavenia
            </div>
            <div
              className={PANEL_SECTION_SUBTITLE}
              style={{ color: appColors.textMuted }}
            >
              Jazyk, jednotky, časové pásmo a formát dátumu/času pre celé rozhranie.
            </div>
          </div>

          <Button size="sm" variant="primary" disabled={disabled} onClick={handleSave}>
            {saving ? "Ukladám…" : "Uložiť"}
          </Button>
        </div>

        {/* preferencie */}
        <div className="mt-3">
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
              <label className="text-xs font-medium" style={{ color: appColors.textMuted }}>
                Formát dátumu
              </label>
              <input
                className={[inputClass, "mt-1"].join(" ")}
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
        </div>

        {/* účet – akcie */}
        <div className="mt-4 pt-3 border-t" style={{ borderColor: appColors.divider }}>
          <h3 className={PANEL_CARD_TITLE} style={{ color: appColors.textPrimary }}>
            Akcie účtu
          </h3>
          <p className="text-xs mt-1" style={{ color: appColors.textMuted }}>
            Rýchle akcie pre zmenu hesla a e-mailu (otvoria samostatnú stránku).
          </p>

          <div className={[PANEL_ACTIONS_INLINE, "mt-2"].join(" ")}>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => router.push("/forgot-password")}
            >
              Zmeniť heslo (e-mailom)
            </Button>

            <Button size="xs" variant="secondary" onClick={() => router.push("/profile")}>
              Zmeniť e-mail / profil
            </Button>
          </div>
        </div>

        {/* zrušenie účtu */}
        <div className="mt-4 pt-3 border-t" style={{ borderColor: appColors.divider }}>
          <h3 className={PANEL_CARD_TITLE} style={{ color: appColors.statusError }}>
            Zrušenie účtu (nezvratné)
          </h3>

          <div
            className="mt-2 rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor: "rgba(239,68,68,0.55)",
              background: "rgba(127,29,29,0.35)",
              color: appColors.textPrimary,
            }}
          >
            {loadingDelete ? (
              <p style={{ color: appColors.textMuted }}>
                Kontrolujem stav zmazania účtu…
              </p>
            ) : deletePending ? (
              <>
                <p>
                  Účet je <span className="font-semibold">označený na zmazanie</span>.
                </p>
                <p className="mt-1" style={{ color: appColors.textMuted }}>
                  Ak nič neurobíš, všetky tvoje dáta (tréningy, plány, prepojenia ako Strava) sa po
                  lehote trvalo vymažú.
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
                  Najprv sa účet označí na zmazanie. Počas lehoty ho môžeš ešte zrušiť, potom sa
                  odstránia všetky dáta.
                </p>
              </>
            )}
          </div>

          <div className={[PANEL_ACTIONS_INLINE, "mt-2"].join(" ")}>
            {deletePending ? (
              <Button
                size="xs"
                variant="secondary"
                disabled={processingDelete || !userId}
                onClick={handleCancelDelete}
              >
                {processingDelete ? (
                  <span className="inline-flex items-center gap-1">
                    <LoadingSpinner size="button" />
                    Ruším…
                  </span>
                ) : (
                  "Zrušiť plánované zmazanie"
                )}
              </Button>
            ) : (
              <Button
                size="xs"
                variant={"danger" as any}
                disabled={processingDelete || !userId}
                onClick={openDeleteModal}
              >
                Označiť účet na zmazanie
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ===== Delete modal (Strava-like, 2-step) ===== */}
      {deleteStep !== "none" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-xl border p-4"
            style={{
              background: appColors.surfaceCard,
              borderColor: "rgba(239, 68, 68, 0.35)",
              color: appColors.textPrimary,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div
                  className="text-base font-semibold"
                  style={{ color: "rgba(254, 202, 202, 0.95)" }}
                >
                  {deleteStep === "step1" ? "Zrušenie účtu" : "Naozaj označiť účet na zmazanie?"}
                </div>
                <div className="text-[12px] mt-1" style={{ color: appColors.textMuted }}>
                  Toto je vážna akcia.
                </div>
              </div>

              <button
                type="button"
                onClick={closeDeleteModal}
                className="text-xl leading-none opacity-70 hover:opacity-100"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-3 text-sm" style={{ color: appColors.textMuted }}>
              {deleteStep === "step1" ? (
                <>
                  Najprv sa účet označí na zmazanie. Počas lehoty ho môžeš ešte zrušiť, potom sa
                  odstránia všetky dáta.
                </>
              ) : (
                <>
                  Súhlasím so spracovaním žiadosti o zrušenie účtu a beriem na vedomie, že po uplynutí
                  lehoty sa moje dáta v aplikácii trvalo vymažú.
                  <div className="mt-2">
                    Pozor: Prepojenie so Stravou sa zruší a dáta importované zo Stravy v tejto aplikácii
                    sa vymažú. Strava účet ako taký sa týmto nemaže.
                  </div>
                </>
              )}
            </div>

            {/* checkbox gate (rovnaké v oboch krokoch) */}
            <div className="mt-4">
              <Checkbox
                checked={deleteConsent}
                onChange={(e) => setDeleteConsent(e.currentTarget.checked)}
                label={
                  <span className="text-sm">
                    Rozumiem dôsledkom a súhlasím so zrušením účtu a vymazaním dát v tejto aplikácii.
                  </span>
                }
                hint={
                  <span className="text-[11px]">
                    Bez tohto súhlasu pokračovanie nepovolíme.
                  </span>
                }
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={closeDeleteModal}
                disabled={processingDelete}
              >
                Zrušiť
              </Button>

              {deleteStep === "step1" ? (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!deleteConsent || processingDelete}
                  onClick={goDeleteStep2}
                  title={!deleteConsent ? "Zaškrtni súhlas, aby sa pokračovalo." : "Pokračovať"}
                >
                  Pokračovať
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!deleteConsent || processingDelete}
                  onClick={handleConfirmDelete}
                  title={!deleteConsent ? "Zaškrtni súhlas, aby sa zmazanie povolilo." : "Označiť na zmazanie"}
                >
                  {processingDelete ? (
                    <span className="inline-flex items-center gap-1">
                      <LoadingSpinner size="button" />
                      Označujem…
                    </span>
                  ) : (
                    "Áno, označiť na zmazanie"
                  )}
                </Button>
              )}
            </div>

            {!deleteConsent && (
              <p className="text-[11px] mt-2" style={{ color: appColors.textMuted }}>
                Pre pokračovanie musíš zaškrtnúť súhlas.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}