// src/features/profile/components/TableStatic.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import Button from "@/shared/components/ui/Button";
import { Plus, Minus } from "lucide-react";
import { toast } from "@/shared/components/ui/Toast";
import { CARD, ICON_BUTTON } from "@/shared/ui/classes";
import { inputClass, labelClass } from "@/shared/ui";

type Sex = "M" | "F" | null;

type StaticProfile = {
  sex: Sex;
  birth_date: string | null; // "YYYY-MM-DD"
  height_cm: number | null;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="opacity-70 text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function TableStatic() {
  const { userId, userUid } = useUserId() as { userId: number | null; userUid?: string | null };
  const [open, setOpen] = useState(false);
  const [staticData, setStaticData] = useState<StaticProfile>({
    sex: null,
    birth_date: null,
    height_cm: null,
  });
  const [loading, setLoading] = useState(false);

  const uidQS = userUid ? `?user_uid=${encodeURIComponent(userUid)}` : "";

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API_URL}/profile/static/${userId}${uidQS}`, { cache: "no-store" });
        const js = await r.json().catch(() => ({}));
        if (alive && js?.success) setStaticData(js.data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, uidQS]);

  async function handleSave() {
    if (!userId) return;
    try {
      const res = await fetch(`${API_URL}/profile/static/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_uid: userUid ?? undefined, ...staticData }),
      });
      const js = await res.json();
      if (js?.success) {
        toast.success("✅ Static profile uložený");
        setOpen(false);
      } else {
        toast.error(`❌ Chyba: ${js?.detail || "unknown"}`);
      }
    } catch (e: any) {
      toast.error(`❌ Request failed: ${e?.message || e}`);
    }
  }

  const summary = useMemo(() => {
    const sex = staticData.sex || "—";
    const bd  = staticData.birth_date || "—";
    const h   = Number.isFinite(staticData.height_cm as number) ? `${staticData.height_cm} cm` : "—";
    return { sex, bd, h };
  }, [staticData]);

  return (
    <div className={`${CARD} p-4 mb-6`}>
      <div className="flex items-center justify-between">
        <h2 className="text-base md:text-lg font-semibold">Static Profile</h2>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={ICON_BUTTON}
          aria-label={open ? "Zbaliť" : "Rozbaliť"}
          title={open ? "Zbaliť" : "Rozbaliť"}
        >
          {open ? <Minus size={16} /> : <Plus size={16} />}
        </button>
      </div>

      {!open ? (
        <div className="mt-2">
          <Row label="Sex"        value={summary.sex as string} />
          <Row label="Birth date" value={summary.bd as string} />
          <Row label="Height"     value={summary.h as string} />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={`${labelClass} block mb-1`}>Sex</label>
            <select
              value={staticData.sex ?? ""}
              onChange={(e) => setStaticData(s => ({ ...s, sex: (e.target.value || null) as Sex }))}
              className={`${inputClass} h-9 text-sm`}
            >
              <option value="">—</option>
              <option value="M">Muž</option>
              <option value="F">Žena</option>
            </select>
          </div>

          <div>
            <label className={`${labelClass} block mb-1`}>Birth date</label>
            <input
              type="date"
              value={staticData.birth_date ?? ""}
              onChange={(e) => setStaticData(s => ({ ...s, birth_date: e.target.value || null }))}
              className={`${inputClass} h-9 text-sm`}
            />
          </div>

          <div>
            <label className={`${labelClass} block mb-1`}>Height (cm)</label>
            <input
              type="number"
              inputMode="decimal"
              value={staticData.height_cm ?? ""}
              onChange={(e) => setStaticData(s => ({ ...s, height_cm: e.target.value ? Number(e.target.value) : null }))}
              className={`${inputClass} h-9 text-sm text-center`}
            />
          </div>

          <div className="sm:col-span-3 flex justify-end pt-1">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Ukladám…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}