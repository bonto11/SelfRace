// src/features/profile/components/FormStatic.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

import Button from "@/app/shared/components/ui/Button";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import TextField from "@/app/shared/components/ui/TextField";
import DateField from "@/app/shared/components/ui/DateField";
import SelectField from "@/app/shared/components/ui/SelectField";
import { toast } from "@/app/shared/components/ui/Toast";

import {
  apiGetStaticProfile,
  apiSaveStaticProfile,
} from "@/app/features/profile/api/static";
import type { Sex, StaticProfile } from "@/app/features/profile/types/profile";
import { summarizeStaticProfile } from "@/app/features/profile/utils/profile";
import { appColors } from "@/app/shared/theme/app_colors";

import {
  CARD,
  SECTION,
  FORM_GRID_TWO,
  PANEL_SECTION_HEAD,
  CARD_HEAD_INSET,
  CARD_BODY_INSET,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_STACK,
  PANEL_PREVIEW,
  SURFACE_CARD_STYLE,
  SECTION_STYLE,

  // reuse inputsCard tokens
  INPUTS_CARD_BODY,
  INPUTS_CARD_FOOTER,
  INPUTS_CARD_SAVE_WRAP,
  INPUTS_CARD_SAVE_BTN,
  INPUTS_CARD_LABEL_SM_1,
  INPUTS_CARD_TOGGLE,
} from "@/app/shared/ui/tokens";

const EMPTY: StaticProfile = {
  sex: null,
  birth_date: null,
  height_cm: null,
};

export default function FormStatic() {
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

  const previewText = [
    `Pohlavie: ${String(summary.sex ?? "—")}`,
    `Narodenie: ${String(summary.bd ?? "—")}`,
    `Výška: ${String(summary.h ?? "—")}`,
  ].join(" • ");

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
    <section className={CARD} style={SURFACE_CARD_STYLE}>
      <div className={`${PANEL_SECTION_HEAD} ${CARD_HEAD_INSET}`}>
        <div className="min-w-0">
          <div
            className={PANEL_SECTION_TITLE}
            style={{ color: appColors.textPrimary }}
          >
            Základné údaje
          </div>
          <div
            className={PANEL_SECTION_SUBTITLE}
            style={{ color: appColors.textMuted }}
          >
            Pohlavie, dátum narodenia a výška.
          </div>
        </div>
      </div>

      <div className={CARD_BODY_INSET}>
        {!open && (
          <div
            className={["mt-3", PANEL_PREVIEW].join(" ")}
            style={{ color: appColors.textMuted }}
          >
            {previewText}
          </div>
        )}

        {open && (
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
                  value={data.sex}
                  disabled={loading}
                  onChange={(v) =>
                    setData((s) => ({ ...s, sex: (v as Sex) || null }))
                  }
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
                  value={data.birth_date}
                  disabled={loading}
                  onChange={(v) => setData((s) => ({ ...s, birth_date: v }))}
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
        )}

        <div className={INPUTS_CARD_FOOTER}>
          {open && (
            <div className={INPUTS_CARD_SAVE_WRAP}>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSave}
                disabled={loading || !userId}
                className={INPUTS_CARD_SAVE_BTN}
              >
                {loading ? "Ukladám…" : "Uložiť"}
              </Button>
            </div>
          )}

          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((v) => !v)}
            className={INPUTS_CARD_TOGGLE}
          />
        </div>
      </div>
    </section>
  );
}