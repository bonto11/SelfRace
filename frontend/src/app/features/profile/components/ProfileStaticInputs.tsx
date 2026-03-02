"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import DateField from "@/app/shared/ui/components/DateField";
import SelectField from "@/app/shared/ui/components/SelectField";
import { toast } from "@/app/shared/ui/components/Toast";

import {
  apiGetStaticProfile,
  apiSaveStaticProfile,
} from "@/app/features/profile/api/static";
import type { Sex, StaticProfile } from "@/app/features/profile/types/profile";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  SECTION,
  FORM_GRID_TWO,
  PANEL_STACK,
  SECTION_STYLE,
  INPUTS_CARD_BODY,
  INPUTS_CARD_LABEL_SM_1,
  INPUTS_CARD_SAVE_BTN,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT"; 

const EMPTY: StaticProfile = {
  sex: null,
  birth_date: null,
  height_cm: null,
};

export default function ProfileStaticInputs() {
  const { userId } = useUserId() as { userId: number | null };
  const t = useT(); 

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<StaticProfile>(EMPTY);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const d = await apiGetStaticProfile(userId);
        if (!alive) return;
        if (d) setData(d);
      } catch (e: any) {
        console.warn("[ProfileStaticInputs] load failed", t(e?.message as any));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, t]);

  async function handleSave() {
    if (!userId) {
      toast.error(t("api.common.missingUserAuth"));
      return;
    }
    try {
      setLoading(true);
      const saved = await apiSaveStaticProfile(userId, data);
      setData(saved);
      toast.success(t("profile.static.saveSuccess"));
      setOpen(false);
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("api.profile.staticSaveFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <InputsCard
      title={t("profile.static.title")}
      subtitle={t("profile.static.subtitle")}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
      actions={
        <Button
          size="sm"
          variant="primary"
          onClick={handleSave}
          disabled={loading || !userId}
          className={INPUTS_CARD_SAVE_BTN}
        >
          {loading ? t("common.saving") : t("common.save")}
        </Button>
      }
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className={FORM_GRID_TWO}>
          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("profile.static.sex")}
            </div>

            <SelectField
              value={(data.sex ?? "") as any}
              disabled={loading}
              onChange={(e: any) => {
                const v = (e?.target?.value ?? "") as string;
                setData((s) => ({
                  ...s,
                  sex: v ? (v as Sex) : null,
                }));
              }}
              options={[
                { value: "", label: "—" },
                { value: "M", label: t("profile.static.sexMale") },
                { value: "F", label: t("profile.static.sexFemale") },
              ]}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("profile.static.birthDate")}
            </div>

            <DateField
              disabled={loading}
              value={data.birth_date}
              onChange={(v) =>
                setData((s) => ({
                  ...s,
                  birth_date: v || null,
                }))
              }
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("profile.static.height")}
            </div>

            <TextField
              type="number"
              inputMode="numeric"
              value={data.height_cm ?? ""}
              onChange={(e) =>
                setData((s) => ({
                  ...s,
                  height_cm: e.target.value ? Number(e.target.value) : null,
                }))
              }
              placeholder="cm"
              disabled={loading}
            />
          </section>
        </div>
      </div>
    </InputsCard>
  );
}