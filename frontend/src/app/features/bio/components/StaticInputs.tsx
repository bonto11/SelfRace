"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import DateField from "@/app/shared/ui/components/DateField";
import SelectField from "@/app/shared/ui/components/SelectField";
// ✅ Import nášho točiaceho bubna
import NumberWheelField from "@/app/shared/ui/components/NumberWheelField";
import { toast } from "@/app/shared/ui/components/Toast";

import {
  apiGetStaticProfile,
  apiSaveStaticProfile,
} from "@/app/features/performance/api/static";
import type { Sex, StaticProfile } from "@/app/features/performance/types/performance";
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
        if (alive && d) setData(d);
      } catch (e: any) {
        console.warn("[ProfileStaticInputs] load failed");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [userId]);

  async function handleSave() {
    if (!userId) return;
    
    try {
      setLoading(true);
      const saved = await apiSaveStaticProfile(userId, data);
      setData(saved);
      toast.success(t("performance.static.saveSuccess"));
      setOpen(false);
    } catch (e: any) {
      toast.error(t("api.performance.staticSaveFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <InputsCard
      title={t("performance.static.title")}
      subtitle={t("performance.static.subtitle")}
      open={open}
      onOpenChange={setOpen}
      actions={
        <Button size="sm" variant="primary" onClick={handleSave} disabled={loading || !userId}>
          {loading ? t("common.saving") : t("common.save")}
        </Button>
      }
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className={FORM_GRID_TWO}>
          {/* Pohlavie */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("performance.static.sex")}
            </div>
            <SelectField
              value={(data.sex ?? "") as any}
              disabled={loading}
              onChange={(e: any) => {
                const v = e?.target?.value as string;
                setData(s => ({ ...s, sex: v ? (v as Sex) : null }));
              }}
              options={[
                { value: "", label: "—" },
                { value: "M", label: t("performance.static.sexMale") },
                { value: "F", label: t("performance.static.sexFemale") },
              ]}
            />
          </section>

          {/* Dátum narodenia */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("performance.static.birthDate")}
            </div>
            <DateField
              disabled={loading}
              value={data.birth_date}
              onChange={(v) => setData(s => ({ ...s, birth_date: v || null }))}
            />
          </section>

          {/* Výška */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("performance.static.height")}
            </div>
            {/* ✅ Nahradené za NumberWheelField */}
            <NumberWheelField
              min={100}
              max={250}
              step={1}
              hint="cm"
              value={data.height_cm ?? ""}
              disabled={loading}
              onChange={(val) => setData(s => ({ ...s, height_cm: val }))}
            />
          </section>
        </div>
      </div>
    </InputsCard>
  );
}