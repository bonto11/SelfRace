// src/features/profile/components/FormStatic.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import { toast } from "@/app/shared/components/ui/Toast";

import {
  apiGetStaticProfile,
  apiSaveStaticProfile,
} from "@/app/features/profile/api/static";
import type { Sex, StaticProfile } from "@/app/features/profile/types/profile";
import { summarizeStaticProfile } from "@/app/features/profile/utils/profile";

import {
  // layout
  CARD,
  SECTION,
  FORM_GRID_TWO,
  FORM_GRID_SPLIT,
  PANEL_SECTION_HEAD,
  CARD_HEAD_INSET,
  CARD_BODY_INSET,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_STACK,
  PANEL_ACTIONS_INLINE,
  PANEL_PREVIEW,

  // styles
  SURFACE_CARD_STYLE,
  SECTION_STYLE,

  // misc
  PILL_BUTTON,
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
    `Sex: ${String(summary.sex ?? "—")}`,
    `Birth: ${String(summary.bd ?? "—")}`,
    `Height: ${String(summary.h ?? "—")}`,
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
      toast.success("Static profile uložený.");
      setOpen(false);
    } catch (e: any) {
      toast.error("Chyba: " + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={CARD} style={SURFACE_CARD_STYLE}>
      {/* HEAD (ako Recovery) */}
      <div className={`${PANEL_SECTION_HEAD} ${CARD_HEAD_INSET}`}>
        <div className="min-w-0">
          <div className={PANEL_SECTION_TITLE}>Static Profile</div>
          <div className={PANEL_SECTION_SUBTITLE}>
            Pohlavie, dátum narodenia a výška.
          </div>
        </div>

        <div className={PANEL_ACTIONS_INLINE}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setOpen((v) => !v)}
            disabled={loading}
            aria-label={open ? "Zbaliť" : "Rozbaliť"}
          >
            {open ? "Zbaliť" : "Rozbaliť"}
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={handleSave}
            disabled={loading || !userId}
          >
            {loading ? "Ukladám…" : "Uložiť"}
          </Button>
        </div>
      </div>

      <div className={CARD_BODY_INSET}>
        {/* COLLAPSED PREVIEW (ako Recovery) */}
        {!open && <div className={["mt-3", PANEL_PREVIEW].join(" ")}>{previewText}</div>}

        {/* BODY (ako Recovery) */}
        {open && (
          <div className={["mt-4", PANEL_STACK].join(" ")}>
            <div className={FORM_GRID_TWO}>
              <section className={SECTION} style={SECTION_STYLE}>
                <div className="text-sm mb-1 opacity-80">Sex</div>

                {/* select štýlujeme rovnakým PILL_BUTTON ako date v Recovery */}
                <select
                  value={data.sex ?? ""}
                  onChange={(e) =>
                    setData((s) => ({
                      ...s,
                      sex: (e.target.value || null) as Sex,
                    }))
                  }
                  disabled={loading}
                  className={[
                    PILL_BUTTON,
                    "w-full px-3 py-2 !rounded-xl",
                    "[color-scheme:dark]",
                  ].join(" ")}
                >
                  <option value="">—</option>
                  <option value="M">Muž</option>
                  <option value="F">Žena</option>
                </select>
              </section>

              <section className={SECTION} style={SECTION_STYLE}>
                <div className="text-sm mb-1 opacity-80">Birth date</div>

                {/* date presne ako Recovery (pill + color-scheme) */}
                <input
                  type="date"
                  value={data.birth_date ?? ""}
                  onChange={(e) =>
                    setData((s) => ({ ...s, birth_date: e.target.value || null }))
                  }
                  disabled={loading}
                  className={[
                    PILL_BUTTON,
                    "w-full text-center px-3 py-2 !rounded-xl",
                    "[color-scheme:dark]",
                  ].join(" ")}
                />
              </section>

              <section className={SECTION} style={SECTION_STYLE}>
                <div className="text-sm mb-1 opacity-80">Height</div>
                <TextField
                  type="number"
                  inputMode="decimal"
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

              {/* nech to pekne sadne v mriežke ako v Recovery */}
              <section className={SECTION} style={SECTION_STYLE}>
                <div className="text-sm mb-1 opacity-80">Quick summary</div>
                <div className={FORM_GRID_SPLIT}>
                  <TextField value={String(summary.sex ?? "—")} disabled />
                  <TextField value={String(summary.h ?? "—")} disabled />
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}