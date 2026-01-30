// src/app/features/account/components/SettingsInputs.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiFetchUserPref, apiUpsertUserPref } from "@/app/features/prefs/api/prefs";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import SelectField from "@/app/shared/ui/components/SelectField";
import Checkbox from "@/app/shared/ui/components/CheckBox";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";

import {
  apiGetAccountDeleteStatus,
  apiRequestAccountDelete,
  apiCancelAccountDelete,
} from "@/app/features/account/api/account";

import type { UserSettings, AccountDeleteStatus } from "@/app/features/account/types/account";
import { appColors } from "@/app/shared/ui/theme/app_colors";

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

type DeleteModalKind = "request" | "cancel" | null;

// robust fallback (kým BE všade nevracia status)
type DeleteState = "none" | "pending" | "cancelled" | "deleted";
function getDeleteState(st: AccountDeleteStatus | null): DeleteState {
  const anySt = st as any;
  const status = (anySt?.status as DeleteState | undefined) ?? undefined;
  if (status) return status;

  // fallback
  if (anySt?.hard_deleted_at) return "deleted";
  if (anySt?.cancelled_at) return "cancelled";
  if (anySt?.pending || anySt?.delete_at) return "pending";
  return "none";
}

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

  // modal state (Strava-like)
  const [deleteModal, setDeleteModal] = useState<DeleteModalKind>(null);
  const [deleteConsentChecked, setDeleteConsentChecked] = useState(false);

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

  function openDeleteRequestModal() {
    setDeleteConsentChecked(false);
    setDeleteModal("request");
  }

  function openDeleteCancelModal() {
    setDeleteConsentChecked(false);
    setDeleteModal("cancel");
  }

  function closeDeleteModal() {
    setDeleteModal(null);
    setDeleteConsentChecked(false);
  }

  async function confirmRequestDelete() {
    if (!userId || processingDelete) return;

    if (!deleteConsentChecked) {
      toast.error("Najprv potvrď súhlas (checkbox).");
      return;
    }

    setProcessingDelete(true);
    try {
      const st = await apiRequestAccountDelete(userId);
      setDeleteStatus(st);
      closeDeleteModal();
      toast.success("Účet je označený na zmazanie. Do lehoty to môžeš ešte zrušiť.");
    } catch (e: any) {
      console.error("[SettingsInputs] delete request error", e);
      toast.error(e?.message || "Nepodarilo sa označiť účet na zmazanie.");
    } finally {
      setProcessingDelete(false);
    }
  }

  async function confirmCancelDelete() {
    if (!userId || processingDelete) return;

    if (!deleteConsentChecked) {
      toast.error("Najprv potvrď súhlas (checkbox).");
      return;
    }

    setProcessingDelete(true);
    try {
      const st = await apiCancelAccountDelete(userId);
      setDeleteStatus(st);
      closeDeleteModal();
      toast.success("Plánované zmazanie účtu bolo zrušené.");
    } catch (e: any) {
      console.error("[SettingsInputs] cancel delete error", e);
      toast.error(e?.message || "Nepodarilo sa zrušiť plánované zmazanie.");
    } finally {
      setProcessingDelete(false);
    }
  }

  const disabled = !userId || loading || saving;
  const busyAny = saving || processingDelete;

  const deleteState = getDeleteState(deleteStatus);
  const deletePending = deleteState === "pending";
  const deleteCancelled = deleteState === "cancelled";

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
        return deleteStatus.delete_at as any;
      }
    })();

  const previewText = useMemo(() => {
    const lang = settings.language === "sk" ? "SK" : "EN";
    const units = settings.units === "metric" ? "metric" : "imperial";
    const wk = settings.week_start;
    const tf = settings.time_format_24h ? "24h" : "12h";
    const tz = settings.timezone || "—";

    const del = loadingDelete
      ? "delete: …"
      : deleteState === "pending"
        ? `delete: ${deleteAtLabel ?? "pending"}`
        : deleteState === "cancelled"
          ? "delete: cancelled"
          : "delete: —";

    return `${lang} • ${units} • ${tz} • week ${wk} • ${tf} • ${del}`;
  }, [
    settings.language,
    settings.units,
    settings.timezone,
    settings.week_start,
    settings.time_format_24h,
    loadingDelete,
    deleteState,
    deleteAtLabel,
  ]);

  return (
    <>
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

            {/* Status box: pending = red, cancelled = neutral, none = red info */}
            <div
              className="mt-2 rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor:
                  deleteCancelled ? "rgba(148,163,184,0.35)" : "rgba(239,68,68,0.55)",
                background: deleteCancelled ? "rgba(30,41,59,0.35)" : "rgba(127,29,29,0.35)",
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
                    Ak nič neurobíš, všetky tvoje dáta v aplikácii sa po uplynutí lehoty trvalo vymažú.
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
                  <p className="mt-1" style={{ color: appColors.textMuted }}>
                    Poznámka: Nevymaže sa tvoj Strava účet – odstránia sa len importované dáta a prepojenie v tejto aplikácii.
                  </p>
                </>
              ) : deleteCancelled ? (
                <>
                  <p>
                    Plánované zmazanie účtu bolo <span className="font-semibold">zrušené</span>.
                  </p>
                  <p className="mt-1" style={{ color: appColors.textMuted }}>
                    Účet je aktívny a tvoje dáta v aplikácii sa nevymažú.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Zmazanie účtu je <span className="font-semibold">nezvratné</span>.
                  </p>
                  <p className="mt-1" style={{ color: appColors.textMuted }}>
                    Najprv sa účet označí na zmazanie. Počas lehoty ho môžeš ešte zrušiť, potom sa odstránia všetky dáta v aplikácii.
                  </p>
                  <p className="mt-1" style={{ color: appColors.textMuted }}>
                    Poznámka: Nevymaže sa tvoj Strava účet – odstránia sa len dáta uložené v tejto aplikácii.
                  </p>
                </>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              {deletePending ? (
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={busyAny || !userId}
                  onClick={openDeleteCancelModal}
                >
                  Zrušiť plánované zmazanie
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant={"danger" as any}
                  disabled={busyAny || !userId}
                  onClick={openDeleteRequestModal}
                >
                  Označiť účet na zmazanie
                </Button>
              )}

              {/* keď je cancelled, nech má user jasný návrat do normálu */}
              {deleteCancelled && (
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={loadingDelete || !userId}
                  onClick={() => {
                    setLoadingDelete(true);
                    apiGetAccountDeleteStatus(userId!)
                      .then(setDeleteStatus)
                      .catch((e) => console.error("[SettingsInputs] delete status refresh error", e))
                      .finally(() => setLoadingDelete(false));
                  }}
                >
                  Obnoviť stav
                </Button>
              )}
            </div>
          </div>
        </div>
      </InputsCard>

      {/* ===== Delete / Cancel modal (Strava-like) ===== */}
      {deleteModal && (
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
                  {deleteModal === "request" ? "Zrušenie účtu" : "Zrušiť plánované zmazanie"}
                </div>
                <div className="text-[12px] mt-1" style={{ color: appColors.textMuted }}>
                  {deleteModal === "request" ? "Toto je vážna akcia." : "Týmto ponecháš účet aktívny."}
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

            {deleteModal === "request" ? (
              <div className="mt-3 text-sm" style={{ color: appColors.textMuted }}>
                Najprv sa účet označí na zmazanie. Strava sa ale odpojí okamžite a vymažú sa importované dáta zo Stravy v tejto aplikácii.
                Počas lehoty to môžeš ešte odvolať, ak nie tak potom sa odstránia všetky dáta v aplikácii.
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li>trvalo sa vymažú tréningy, plány a nastavenia uložené v tejto aplikácii</li>
                  <li>odpojí sa Strava a vymažú sa importované dáta zo Stravy v tejto aplikácii</li>
                  <li>tvoj Strava účet sa nevymaže</li>
                </ul>
              </div>
            ) : (
              <div className="mt-3 text-sm" style={{ color: appColors.textMuted }}>
                Zrušením plánovaného zmazania zostane účet aktívny a tvoje dáta v aplikácii sa nevymažú.
                Strava sa ale bude musieť opäť pripojiť a budeš mať možnosť skráteného reimportu.
              </div>
            )}

            <div className="mt-4">
              <Checkbox
                checked={deleteConsentChecked}
                onChange={(e) => setDeleteConsentChecked(e.currentTarget.checked)}
                label={
                  <span className="text-sm">
                    {deleteModal === "request"
                      ? "Súhlasím so spracovaním žiadosti o zrušenie účtu a beriem na vedomie, že po uplynutí lehoty sa moje dáta v aplikácii trvalo vymažú a že Strava dáta v SelfRace aplikácii budú zmazané okamžite."
                      : "Rozumiem a chcem zrušiť plánované zmazanie účtu."}
                  </span>
                }
                hint={<span className="text-[11px]">Bez tohto súhlasu akciu nepovolíme.</span>}
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={closeDeleteModal} disabled={processingDelete}>
                Zrušiť
              </Button>

              {deleteModal === "request" ? (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!deleteConsentChecked || processingDelete}
                  onClick={confirmRequestDelete}
                  title={!deleteConsentChecked ? "Zaškrtni súhlas, aby sa akcia povolila." : "Označiť účet na zmazanie"}
                >
                  {processingDelete ? (
                    <span className="inline-flex items-center gap-1">
                      <LoadingSpinner size="button" />
                      Spracúvam…
                    </span>
                  ) : (
                    "Označiť na zmazanie"
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!deleteConsentChecked || processingDelete}
                  onClick={confirmCancelDelete}
                  title={!deleteConsentChecked ? "Zaškrtni súhlas, aby sa akcia povolila." : "Zrušiť plánované zmazanie"}
                >
                  {processingDelete ? (
                    <span className="inline-flex items-center gap-1">
                      <LoadingSpinner size="button" />
                      Spracúvam…
                    </span>
                  ) : (
                    "Zrušiť zmazanie"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}