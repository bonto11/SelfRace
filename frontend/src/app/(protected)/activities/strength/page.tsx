// src/app/(protected)/activities/strength/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  apiListStrengthSessions,
  apiCreateStrengthSession,
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

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => router.push(`/activities/strength/${s.id}`)}
                className={[SESSION_CARD, SESSION_CARD_HOVER, "text-left w-full"].join(" ")}
                style={SESSION_CARD_STYLE}
              >
                <div className={PANEL_PAD}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {s.title || t("strengthLog.widget.title")}
                      </div>
                      <div className="text-[11px] opacity-60 mt-0.5">
                        {formatDate(s.session_date)}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
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
                  </div>

                  <div className="mt-2 text-[11px] opacity-70">
                    {[
                      exCount > 0 ? `${exCount} ${t("coach.exercises")}` : null,
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
                </div>
              </button>
            );
          })
        )}
      </div>
    </PageShell>
  );
}
