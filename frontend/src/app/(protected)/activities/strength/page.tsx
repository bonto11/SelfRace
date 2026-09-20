// src/app/(protected)/activities/strength/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { toast } from "@/app/shared/ui/components/Toast";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  apiListStrengthSessions,
  apiCreateStrengthSession,
  apiDeleteStrengthSession,
  type StrengthSession,
} from "@/app/features/activities/api/strength_sessions";
import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
  SESSION_CARD_HOVER,
  PANEL_STACK,
  PANEL_PAD,
} from "@/app/shared/ui/tokens";

function sessionVolume(s: StrengthSession): number {
  let v = 0;
  for (const ex of s.log?.exercises ?? [])
    for (const set of ex.sets ?? [])
      if (!set.is_warmup && set.weight_kg && set.reps) v += set.weight_kg * set.reps;
  return Math.round(v);
}

function workSetCount(s: StrengthSession): number {
  let n = 0;
  for (const ex of s.log?.exercises ?? [])
    n += (ex.sets ?? []).filter((set) => !set.is_warmup).length;
  return n;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const wd = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wd} · ${day}`;
}

export default function Page() {
  const t = useT();
  const router = useRouter();
  const { userId } = useUserId();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<StrengthSession[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const rows = await apiListStrengthSessions(userId, { weeks_back: 26, limit: 200 });
    setSessions(rows);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!userId || creating) return;
    setCreating(true);
    const created = await apiCreateStrengthSession(userId, {});
    setCreating(false);
    if (created) router.push(`/activities/strength/${created.id}`);
  };

  // 🌟 Mazanie priamo zo zoznamu - hlavne pre omylom vytvorené prázdne
  // záznamy. Prázdny zápis maže bez potvrdenia (nie je čo stratiť),
  // zápis s dátami sa pýta.
  const handleDelete = async (s: StrengthSession) => {
    if (!userId || deletingId) return;

    const hasData =
      (s.log?.exercises ?? []).length > 0 || !!s.session_note || !!s.title;

    if (hasData) {
      const ok = await confirm({
        title: t("strengthLog.deleteConfirmTitle"),
        message: t("strengthLog.deleteConfirmMessage"),
        okText: t("common.delete"),
        cancelText: t("common.cancel"),
        tone: "danger",
      });
      if (!ok) return;
    }

    setDeletingId(s.id);
    const ok = await apiDeleteStrengthSession(userId, s.id);
    setDeletingId(null);

    if (ok) {
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
      toast.success(t("common.deleted"));
    } else {
      toast.error(t("strengthLog.deleteError"));
    }
  };

  return (
    <PageShell
      title={t("strengthLog.widget.title")}
      showBack
      showPoweredByStrava={false}
    >
      <div className={PANEL_STACK}>
        <Button
          variant="primary"
          size="sm"
          onClick={handleCreate}
          disabled={creating || !userId}
          className="self-start"
        >
          {creating ? <LoadingSpinner size="button" /> : `+ ${t("strengthLog.widget.logNow")}`}
        </Button>

        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="widget" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-white/10 rounded-xl">
            <p className="text-sm opacity-50">{t("strengthLog.widget.empty")}</p>
          </div>
        ) : (
          sessions.map((s) => {
            const vol = sessionVolume(s);
            const sets = workSetCount(s);
            const exCount = (s.log?.exercises ?? []).length;
            const isDeleting = deletingId === s.id;

            return (
              <div
                key={s.id}
                className={[SESSION_CARD, SESSION_CARD_HOVER].join(" ")}
                style={SESSION_CARD_STYLE}
              >
                <div className={PANEL_PAD}>
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => router.push(`/activities/strength/${s.id}`)}
                      className="min-w-0 text-left flex-1"
                    >
                      <div className="text-sm font-semibold truncate">
                        {s.title || t("strengthLog.widget.title")}
                      </div>
                      <div className="text-[11px] opacity-60 mt-0.5">
                        {formatDate(s.session_date)}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        {s.completed && (
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: appColors.brandPrimary }}
                          >
                            ✓ {t("common.done")}
                          </span>
                        )}
                        {s.activity_id && (
                          <span className="text-[10px] opacity-40">Strava ✓</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(s);
                        }}
                        disabled={isDeleting}
                        title={t("common.delete")}
                        className="w-7 h-7 rounded flex items-center justify-center opacity-30 hover:opacity-100 transition-opacity"
                        style={{ color: appColors.statusError }}
                      >
                        {isDeleting ? <LoadingSpinner size="button" /> : "🗑️"}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(`/activities/strength/${s.id}`)}
                    className="w-full text-left"
                  >
                    <div className="mt-2 text-[11px] opacity-70">
                      {[
                        exCount > 0 ? `${exCount} ${t("strengthLog.exercisesUnit")}` : null,
                        sets > 0 ? `${sets} ${t("strengthLog.setsLogged")}` : null,
                        vol > 0 ? `${vol} kg` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>

                    {s.session_note && (
                      <div className="mt-1.5 text-[11px] italic opacity-50 line-clamp-2">
                        {s.session_note}
                      </div>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </PageShell>
  );
}
