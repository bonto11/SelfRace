// src/app/features/profile/components/ProfileStaticInputs.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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
import { summarizeStaticProfile } from "@/app/features/profile/utils/profile";
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

const EMPTY: StaticProfile = {
  sex: null,
  birth_date: null,
  height_cm: null,
};

export default function ProfileStaticInputs() {
  const { userId } = useUserId() as { userId: number | null };

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
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const summary = useMemo(() => summarizeStaticProfile(data), [data]);

  const previewText = useMemo(() => {
    return [
      `Pohlavie: ${String(summary.sex ?? "—")}`,
      `Narodenie: ${String(summary.bd ?? "—")}`,
      `Výška: ${String(summary.h ?? "—")}`,
    ].join(" • ");
  }, [summary]);

  async function handleSave() {
    if (!userId) {
      toast.error("Chýba používateľ.");
      return;
    }
    try {
      setLoading(true);
      const saved = await apiSaveStaticProfile(userId, data);
      setData(saved);
      toast.success("Profil uložený.");
      setOpen(false);
    } catch (e: any) {
      toast.error("Chyba: " + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <InputsCard
      title="Základné údaje"
      subtitle="Pohlavie, dátum narodenia a výška."
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
      actions={
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSave}
          disabled={loading || !userId}
          className={INPUTS_CARD_SAVE_BTN}
        >
          {loading ? "Ukladám…" : "Uložiť"}
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
              Pohlavie
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
                { value: "M", label: "Muž" },
                { value: "F", label: "Žena" },
              ]}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              Dátum narodenia
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
              Výška
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

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              Zhrnutie
            </div>
            <TextField value={previewText} disabled />
          </section>
        </div>
      </div>
    </InputsCard>
  );
}
