"use client";

import { useEffect, useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import {
  PANEL_STACK, PANEL_PAD, PANEL_INNER_STACK,
  PANEL_SECTION_HEAD, PANEL_SECTION_TITLE, PANEL_SECTION_SUBTITLE,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";
import { SESSION_CARD, SESSION_CARD_STYLE } from "@/app/shared/ui/tokens/sessionCard";
import {
  apiGetCoachNotes, apiCreateSticky, apiUpdateSticky,
  apiDeleteNote, type CoachNotesData, type StickyNote,
} from "@/app/features/coach/api/coach_user_notes";

function Card({ title, subtitle, children }: { title?: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
      {(title || subtitle) && (
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0">
            {title && <div className={PANEL_SECTION_TITLE}>{title}</div>}
            {subtitle && <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div>}
          </div>
        </header>
      )}
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>{children}</div>
      <div className={ACCORDION_FOOTER_BAR_MUTED} />
    </section>
  );
}

const MAX_CHARS = 500;

export default function DetailCoachNotes() {
  const { userId } = useUserId();
  const t = useT();

  const [data, setData] = useState<CoachNotesData | null>(null);
  const [loading, setLoading] = useState(false);

  const [newText, setNewText] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await apiGetCoachNotes(userId);
      setData(res);
    } catch {
      toast.error(t("coachNotes.errorLoad"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [userId]);

  const canAddSticky = (data?.sticky_slots_used ?? 0) < (data?.sticky_slots_max ?? 2);

  const handleAddSticky = async () => {
    if (!userId || !newText.trim()) return;
    setSaving(true);
    try {
      const res = await apiCreateSticky(userId, newText.trim());
      if (!res.success) return toast.error(res.message ?? t("coachNotes.errorSave"));
      toast.success(t("coachNotes.saveSuccess"));
      setNewText("");
      await fetchData();
    } catch {
      toast.error(t("coachNotes.errorSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (note: StickyNote) => {
    setEditingId(note.id);
    setEditText(note.text);
  };

  const handleSaveEdit = async (noteId: number) => {
    if (!userId || !editText.trim()) return;
    setSaving(true);
    try {
      const res = await apiUpdateSticky(userId, noteId, editText.trim());
      if (!res.success) return toast.error(t("coachNotes.errorSave"));
      toast.success(t("coachNotes.saveSuccess"));
      setEditingId(null);
      await fetchData();
    } catch {
      toast.error(t("coachNotes.errorSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: number) => {
    if (!userId) return;
    const ok = await confirm({
      title: t("coachNotes.deleteConfirm.title"),
      message: t("coachNotes.deleteConfirm.message"),
      okText: t("coachNotes.deleteConfirm.ok"),
      cancelText: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await apiDeleteNote(userId, noteId);
      toast.success(t("coachNotes.deleteSuccess"));
      await fetchData();
    } catch {
      toast.error(t("coachNotes.errorDelete"));
    }
  };

  if (!userId) return null;

  return (
    <div className={PANEL_STACK}>

      {/* STICKY POZNÁMKY */}
      <Card
        title={t("coachNotes.sticky.title")}
        subtitle={t("coachNotes.sticky.subtitle")}
      >
        {loading ? (
          <div className="flex justify-center p-4"><LoadingSpinner size="button" /></div>
        ) : (
          <>
            {/* Existujúce sticky */}
            {(data?.sticky ?? []).length > 0 && (
              <ul className="space-y-2 mb-4">
                {(data?.sticky ?? []).map((note) => (
                  <li key={note.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    {editingId === note.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          className="w-full rounded bg-white/5 border border-white/10 p-2 text-sm text-white focus:border-white/30 focus:outline-none resize-none"
                          rows={3}
                          value={editText}
                          maxLength={MAX_CHARS}
                          onChange={(e) => setEditText(e.target.value)}
                          disabled={saving}
                        />
                        <div className="text-[10px] text-right opacity-40">{editText.length} / {MAX_CHARS}</div>
                        <div className="flex gap-2">
                          <Button size="xs" variant="primary" onClick={() => handleSaveEdit(note.id)} disabled={saving || !editText.trim()}>
                            {saving ? <LoadingSpinner size="button" /> : t("coachNotes.sticky.save")}
                          </Button>
                          <Button size="xs" variant="secondary" onClick={() => setEditingId(null)} disabled={saving}>
                            {t("common.cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-white/80 leading-relaxed flex-1">{note.text}</p>
                        <div className="flex gap-1 shrink-0">
                          <Button size="xs" variant="secondary" onClick={() => handleStartEdit(note)}>
                            {t("coachNotes.sticky.edit")}
                          </Button>
                          <Button size="xs" variant="danger" onClick={() => handleDelete(note.id)}>
                            🗑️
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Pridať novú sticky */}
            {canAddSticky ? (
              <div className="flex flex-col gap-2">
                <textarea
                  className="w-full rounded bg-white/5 border border-white/10 p-3 text-sm text-white focus:border-white/30 focus:outline-none resize-none placeholder:text-white/20"
                  rows={3}
                  value={newText}
                  maxLength={MAX_CHARS}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder={t("coachNotes.sticky.placeholder")}
                  disabled={saving}
                />
                {newText.length > MAX_CHARS * 0.8 && (
                  <div className="text-[10px] text-right opacity-40">{newText.length} / {MAX_CHARS}</div>
                )}
                <Button size="sm" variant="primary" onClick={handleAddSticky} disabled={saving || !newText.trim()} className="self-end">
                  {saving ? <LoadingSpinner size="button" /> : t("coachNotes.sticky.add")}
                </Button>
              </div>
            ) : (
              <div className="text-[11px] text-white/40 text-center border border-dashed border-white/10 rounded-xl p-3">
                {t("coachNotes.sticky.limitReached")}
              </div>
            )}
          </>
        )}
      </Card>

      {/* HISTÓRIA EPHEMERAL */}
      {(data?.ephemeral_history ?? []).length > 0 && (
        <Card
          title={t("coachNotes.ephemeral.title")}
          subtitle={t("coachNotes.ephemeral.subtitle")}
        >
          <ul className="space-y-2 opacity-80">
            {(data?.ephemeral_history ?? []).map((note) => (
              <li key={note.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 flex items-start justify-between gap-3">
                <p className="text-sm text-white/70 leading-relaxed flex-1">{note.text}</p>
                <span className={`text-[10px] font-bold uppercase shrink-0 mt-0.5 ${note.applied ? "text-emerald-400/60" : "text-yellow-400/80"}`}>
                  {note.applied ? t("coachNotes.ephemeral.applied") : t("coachNotes.ephemeral.pending")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

    </div>
  );
}
