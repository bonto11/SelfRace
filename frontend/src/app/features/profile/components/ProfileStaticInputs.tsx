// src/features/profile/components/ProfileStaticInputs.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

import TextField from "@/app/shared/components/ui/TextField";
import DateField from "@/app/shared/components/ui/DateField";
import SelectField from "@/app/shared/components/ui/SelectField";
import { toast } from "@/app/shared/components/ui/Toast";

import InputsCard from "@/app/shared/components/ui/InputsCard";

import {
  apiGetStaticProfile,
  apiSaveStaticProfile,
} from "@/app/features/profile/api/static";
import type { Sex, StaticProfile } from "@/app/features/profile/types/profile";
import { summarizeStaticProfile } from "@/app/features/profile/utils/profile";

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
    <InputsCard
      title="Základné údaje"
      subtitle="Pohlavie, dátum narodenia a výška."
      previewText={previewText}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      saving={loading}
      onSave={handleSave}
      saveLabel={loading ? "Ukladám…" : "Uložiť"}
      saveDisabled={loading || !userId}
    >
      <InputsCard.Grid>
        <InputsCard.Field label="Pohlavie">
          <SelectField
            value={(data.sex ?? "") as any}
            disabled={loading}
            onChange={(e: any) => {
              const v = (e?.target?.value ?? "") as string;
              setData((s) => ({ ...s, sex: v ? (v as Sex) : null }));
            }}
            options={[
              { value: "", label: "—" },
              { value: "M", label: "Muž" },
              { value: "F", label: "Žena" },
            ]}
          />
        </InputsCard.Field>

        <InputsCard.Field label="Dátum narodenia">
          <DateField
            disabled={loading}
            value={data.birth_date}
            onChange={(v) => setData((s) => ({ ...s, birth_date: v || null }))}
          />
        </InputsCard.Field>

        <InputsCard.Field label="Výška">
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
        </InputsCard.Field>

        <InputsCard.Field label="Zhrnutie">
          <TextField value={previewText} disabled />
        </InputsCard.Field>
      </InputsCard.Grid>
    </InputsCard>
  );
}