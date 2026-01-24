// src/features/profile/components/FormStatic.tsx
"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import Button from "@/app/shared/components/ui/Button";
import { Plus, Minus } from "lucide-react";
import { toast } from "@/app/shared/components/ui/Toast";
import TextField from "@/app/shared/components/ui/TextField";

import {
  apiGetStaticProfile,
  apiSaveStaticProfile,
} from "@/app/features/profile/api/static";
import type { Sex, StaticProfile } from "@/app/features/profile/types/profile";
import { summarizeStaticProfile } from "@/app/features/profile/utils/profile";

import {
  SURFACE_CARD,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_CARD_HEAD,
  PANEL_CARD_TITLE,
  PANEL_LIST,
  PANEL_LIST_ITEM,
  PANEL_ACTION_ROW,
  ICON_BUTTON,
  FIELD_LABEL,
  FORM_GRID_THREE,
  SELECT_BASE,
} from "@/app/shared/ui/tokens";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={PANEL_LIST_ITEM}>
      <span className="opacity-70">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

const EMPTY_STATIC: StaticProfile = {
  sex: null,
  birth_date: null,
  height_cm: null,
};

export default function FormStatic() {
  const { userId } = useUserId() as { userId: number | null };

  const [open, setOpen] = useState(false);
  const [staticData, setStaticData] = useState<StaticProfile>(EMPTY_STATIC);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const data = await apiGetStaticProfile(userId);
        if (alive && data) setStaticData(data);
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
    try {
      setLoading(true);
      const saved = await apiSaveStaticProfile(userId, staticData);
      setStaticData(saved);
      toast.success("✅ Static profile uložený");
      setOpen(false);
    } catch (e: any) {
      toast.error(`❌ Chyba: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  const summary = summarizeStaticProfile(staticData);

  return (
    <section className={SURFACE_CARD}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={PANEL_CARD_HEAD}>
          <h2 className={PANEL_CARD_TITLE}>Static Profile</h2>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={ICON_BUTTON}
            aria-label={open ? "Zbaliť" : "Rozbaliť"}
            title={open ? "Zbaliť" : "Rozbaliť"}
          >
            {open ? <Minus size={16} /> : <Plus size={16} />}
          </button>
        </div>

        {!open ? (
          <div className={PANEL_LIST}>
            <Row label="Sex" value={String(summary.sex ?? "—")} />
            <Row label="Birth date" value={String(summary.bd ?? "—")} />
            <Row label="Height" value={String(summary.h ?? "—")} />
          </div>
        ) : (
          <div className={FORM_GRID_THREE}>
            <div>
              <div className={FIELD_LABEL}>Sex</div>
              <select
                value={staticData.sex ?? ""}
                onChange={(e) =>
                  setStaticData((s) => ({
                    ...s,
                    sex: (e.target.value || null) as Sex,
                  }))
                }
                className={SELECT_BASE}
                disabled={loading}
              >
                <option value="">—</option>
                <option value="M">Muž</option>
                <option value="F">Žena</option>
              </select>
            </div>

            <div>
              <div className={FIELD_LABEL}>Birth date</div>
              {/* TextField drží konzistentný input style ako Recovery */}
              <TextField
                type="date"
                value={staticData.birth_date ?? ""}
                onChange={(e) =>
                  setStaticData((s) => ({
                    ...s,
                    birth_date: e.target.value || null,
                  }))
                }
                disabled={loading}
              />
            </div>

            <div>
              <div className={FIELD_LABEL}>Height (cm)</div>
              <TextField
                type="number"
                inputMode="decimal"
                value={staticData.height_cm ?? ""}
                onChange={(e) =>
                  setStaticData((s) => ({
                    ...s,
                    height_cm: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                disabled={loading}
              />
            </div>

            <div className={PANEL_ACTION_ROW}>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Ukladám…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}