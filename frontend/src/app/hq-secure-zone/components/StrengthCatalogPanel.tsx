"use client";
import { useMemo, useState, type ReactNode } from "react";
import {
  askCatalogAssistant,
  getCatalogExercises,
  getExerciseSuggestions,
  resolveExerciseSuggestion,
  saveCatalogExercise,
} from "../actions";

// Katalóg cvikov v DB (strength_exercises) – návrhy userov, úprava cvikov
// a AI asistent. Zmena sa v appke prejaví bez deployu (BE do 5 min, FE pri
// ďalšom štarte appky).

type Names = { sk: string; cs: string; en: string };
type ExData = {
  target?: string;
  pattern?: string;
  tier?: string;
  equipment?: string[];
  load_type?: string;
  unilateral?: boolean;
  side_option?: boolean;
  measure?: string;
  load_mode?: string;
  skill_demand?: string;
  fatigue_cost?: string;
  eccentric_load?: string;
  rep_suitability?: string[];
  sport_tags?: string[];
  contraindications?: string[];
};
type Exercise = {
  id: string;
  names: Names;
  data: ExData;
  muscles: Record<string, number>;
  categories: string[];
  active: boolean;
  sort_order?: number | null;
};
type Enums = Record<string, string[]>;
type Suggestion = {
  id: number;
  user_id: number;
  user_email?: string | null;
  user_name?: string | null;
  name: string;
  muscles?: string[];
  load_mode?: string;
  measure?: string;
  equipment?: string[];
  notes?: string | null;
  status: string;
  exercise_id?: string | null;
  notified_at?: string | null;
  created_at?: string;
};
type ChatMsg = { role: "admin" | "assistant"; text: string; proposal?: Exercise | null; proposalError?: string | null };

// SK popisy hodnôt (admin panel je len po slovensky)
const LABELS: Record<string, string> = {
  chest: "prsia", back: "chrbát", shoulders: "ramená", biceps: "biceps", triceps: "triceps",
  forearms: "predlaktia", core: "stred tela", glutes: "zadok", quads: "predné stehná",
  hamstrings: "zadné stehná", calves: "lýtka", plyo: "plyometria", iso: "izometria",
  reps: "opakovania", time: "čas (s)", distance: "vzdialenosť (m)",
  external: "závažie povinné", bodyweight_plus: "vlastná váha (+kg voliteľne)",
  low: "nízka", med: "stredná", high: "vysoká",
  primary: "hlavný", secondary: "vedľajší", accessory: "doplnkový", prehab: "prevencia",
};
const L = (v: string) => LABELS[v] ?? v;

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Nový", cls: "bg-violet-900/40 text-violet-300 border-violet-700/50" },
  approved: { label: "Pridaný", cls: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50" },
  rejected: { label: "Zamietnutý", cls: "bg-gray-800 text-gray-400 border-gray-700" },
};

const ERRORS: Record<string, string> = {
  invalid_id: "ID: malé písmená, čísla a podčiarkovník (napr. cable_row_single_arm).",
  names_required: "Vyplň názov v SK, CS aj EN.",
  missing_target: "Vyber skupinu (target).",
  missing_pattern: "Vyber pohybový vzor.",
  missing_tier: "Vyber úroveň cviku.",
  missing_load_type: "Vyber typ záťaže.",
  missing_equipment: "Vyber aspoň jedno vybavenie.",
  missing_primary_muscle: "Aspoň jedna partia musí byť hlavná (1.0).",
  save_failed: "Uloženie zlyhalo – beží migrácia strength_exercises.sql?",
  exercise_not_found: "Cvik s týmto ID v katalógu nie je.",
  ai_generation_failed: "AI teraz neodpovedala, skús znova.",
};
const errText = (code?: string) => (code ? ERRORS[code] ?? `Chyba: ${code}` : "Chyba");

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

const emptyExercise = (): Exercise => ({
  id: "",
  names: { sk: "", cs: "", en: "" },
  data: { equipment: [], measure: "reps", load_mode: "external", skill_demand: "low", fatigue_cost: "low", eccentric_load: "low", unilateral: false, rep_suitability: [], sport_tags: [], contraindications: [] },
  muscles: {},
  categories: [],
  active: true,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{title}</div>
      {children}
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-gray-500">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="bg-black/40 border border-gray-800 rounded-lg px-2 py-1.5 text-white outline-none focus:border-violet-600"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {L(o) !== o ? `${L(o)} (${o})` : o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Chips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${
              on ? "border-violet-500 bg-violet-900/40 text-violet-200" : "border-gray-800 bg-gray-900 text-gray-500"
            }`}
          >
            {L(o)}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- AI chat k cviku ---------- */

function AssistantChat({ exercise, onUseProposal }: { exercise: Exercise; onUseProposal: (e: Exercise) => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const q = text.trim();
    if (!q || busy) return;
    const next: ChatMsg[] = [...msgs, { role: "admin", text: q }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const res: any = await askCatalogAssistant(
        next.map((m) => ({ role: m.role, text: m.text })),
        exercise.id || exercise.names.sk ? exercise : null,
      );
      if (!res?.success) {
        setMsgs([...next, { role: "assistant", text: `⚠️ ${errText(res?.error_code)}` }]);
      } else {
        setMsgs([
          ...next,
          { role: "assistant", text: res.data.reply, proposal: res.data.proposal, proposalError: res.data.proposal_error },
        ]);
      }
    } catch (e: any) {
      setMsgs([...next, { role: "assistant", text: `⚠️ ${e?.message || "Chyba"}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-violet-900/50 bg-violet-950/20 p-3 space-y-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-violet-300">🤖 AI asistent k cviku</div>
      <p className="text-[11px] text-gray-500">
        Pýtaj sa na čo je cvik, aké partie, nastavenie, názvy v jazykoch. Keď navrhne úpravu, „Použiť návrh“ ju dá do
        formulára – uloží sa až tlačidlom Uložiť cvik. AI sa tu neráta do žiadnej kvóty.
      </p>
      {msgs.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {msgs.map((m, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-xs whitespace-pre-wrap ${
                m.role === "admin" ? "bg-gray-800 text-gray-200 ml-8" : "bg-black/40 text-gray-300 mr-8"
              }`}
            >
              {m.text}
              {m.proposal && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => onUseProposal(m.proposal as Exercise)}
                    className="bg-violet-600/30 border border-violet-500/60 hover:bg-violet-600/50 text-violet-100 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg"
                  >
                    ✓ Použiť návrh ({m.proposal.names.sk})
                  </button>
                </div>
              )}
              {m.proposalError && (
                <div className="mt-1 text-[10px] text-amber-400">Návrh AI sa nedal použiť: {errText(m.proposalError)}</div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Napr. Je to správne zaradené? Ako sa volá po česky? Pridaj aj zadok ako pomocnú partiu."
          className="flex-1 bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-violet-600 resize-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !text.trim()}
          className="self-end bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg disabled:opacity-30"
        >
          {busy ? "…" : "Poslať"}
        </button>
      </div>
    </div>
  );
}

/* ---------- editor cviku ---------- */

function ExerciseEditor({
  initial,
  isNew,
  enums,
  onSaved,
  onClose,
}: {
  initial: Exercise;
  isNew: boolean;
  enums: Enums;
  onSaved: (e: Exercise) => void;
  onClose: () => void;
}) {
  const [ex, setEx] = useState<Exercise>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setData = (patch: Partial<ExData>) => setEx((e) => ({ ...e, data: { ...e.data, ...patch } }));
  const setName = (lang: keyof Names, v: string) => setEx((e) => ({ ...e, names: { ...e.names, [lang]: v } }));
  const cycleMuscle = (m: string) =>
    setEx((e) => {
      const cur = e.muscles[m];
      const next = { ...e.muscles };
      if (cur == null) next[m] = 1;
      else if (cur >= 1) next[m] = 0.5;
      else delete next[m];
      return { ...e, muscles: next };
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res: any = await saveCatalogExercise(ex);
      if (!res?.success) {
        setError(errText(res?.error_code));
        return;
      }
      onSaved(res.data.item as Exercise);
    } catch (e: any) {
      setError(e?.message || "Chyba");
    } finally {
      setSaving(false);
    }
  };

  const useProposal = (p: Exercise) =>
    // pri úprave ostáva pôvodné ID – AI by inak založila nový cvik
    setEx({ ...p, id: isNew ? p.id : ex.id, sort_order: ex.sort_order });

  return (
    <div className="rounded-xl border border-violet-800/60 bg-black/40 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black text-white">{isNew ? "Nový cvik" : `Úprava: ${ex.names.sk || ex.id}`}</div>
        <button type="button" onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">
          ×
        </button>
      </div>

      <Section title="Názov">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(["sk", "cs", "en"] as const).map((lang) => (
            <label key={lang} className="flex flex-col gap-1 text-xs">
              <span className="text-gray-500 uppercase">{lang}</span>
              <input
                value={ex.names[lang]}
                onChange={(e) => setName(lang, e.target.value)}
                className="bg-black/40 border border-gray-800 rounded-lg px-2 py-1.5 text-white outline-none focus:border-violet-600"
              />
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-gray-500">ID {isNew ? "(nedá sa neskôr zmeniť – zápisy userov naň odkazujú)" : ""}</span>
          <div className="flex gap-2">
            <input
              value={ex.id}
              disabled={!isNew}
              onChange={(e) => setEx({ ...ex, id: e.target.value.toLowerCase() })}
              className="flex-1 bg-black/40 border border-gray-800 rounded-lg px-2 py-1.5 font-mono text-white outline-none focus:border-violet-600 disabled:opacity-60"
            />
            {isNew && (
              <button
                type="button"
                onClick={() => setEx({ ...ex, id: slug(ex.names.en || ex.names.sk) })}
                className="text-[10px] font-black uppercase px-3 rounded-lg border border-gray-700 text-gray-300"
              >
                z názvu
              </button>
            )}
          </div>
        </label>
      </Section>

      <Section title="Partie (ťuk: hlavná 1.0 → pomocná 0.5 → nič)">
        <div className="flex flex-wrap gap-1.5">
          {(enums.muscles ?? []).map((m) => {
            const w = ex.muscles[m];
            return (
              <button
                key={m}
                type="button"
                onClick={() => cycleMuscle(m)}
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${
                  w == null
                    ? "border-gray-800 bg-gray-900 text-gray-500"
                    : w >= 1
                      ? "border-emerald-500 bg-emerald-900/40 text-emerald-200"
                      : "border-amber-600 bg-amber-900/30 text-amber-200"
                }`}
              >
                {L(m)}
                {w != null ? ` ${w >= 1 ? "1.0" : "0.5"}` : ""}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Zaradenie">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Select label="Skupina (target)" value={ex.data.target} options={enums.target ?? []} onChange={(v) => setData({ target: v })} />
          <Select label="Pohybový vzor" value={ex.data.pattern} options={enums.pattern ?? []} onChange={(v) => setData({ pattern: v })} />
          <Select label="Úroveň" value={ex.data.tier} options={enums.tier ?? []} onChange={(v) => setData({ tier: v })} />
          <Select label="Typ záťaže" value={ex.data.load_type} options={enums.load_type ?? []} onChange={(v) => setData({ load_type: v })} />
          <Select label="Meranie" value={ex.data.measure} options={enums.measure ?? []} onChange={(v) => setData({ measure: v })} />
          <Select label="Váha" value={ex.data.load_mode} options={enums.load_mode ?? []} onChange={(v) => setData({ load_mode: v })} />
          <Select label="Technická náročnosť" value={ex.data.skill_demand} options={enums.skill_demand ?? []} onChange={(v) => setData({ skill_demand: v })} />
          <Select label="Únava" value={ex.data.fatigue_cost} options={enums.fatigue_cost ?? []} onChange={(v) => setData({ fatigue_cost: v })} />
          <Select label="Excentrická záťaž" value={ex.data.eccentric_load} options={enums.eccentric_load ?? []} onChange={(v) => setData({ eccentric_load: v })} />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={!!ex.data.unilateral}
            onChange={(e) => setData({ unilateral: e.target.checked, ...(e.target.checked ? { side_option: false } : {}) })}
          />
          Jednostranný (vždy jedna noha / ruka)
        </label>
        {!ex.data.unilateral ? (
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={!!ex.data.side_option} onChange={(e) => setData({ side_option: e.target.checked })} />
            Dá sa aj jednostranne (user si v zápise zvolí, váha je potom na stranu)
          </label>
        ) : null}
      </Section>

      <Section title="Vybavenie (stačí jedno z nich)">
        <Chips options={enums.equipment ?? []} value={ex.data.equipment ?? []} onChange={(v) => setData({ equipment: v })} />
      </Section>
      <Section title="Na čo sa hodí">
        <Chips options={enums.rep_suitability ?? []} value={ex.data.rep_suitability ?? []} onChange={(v) => setData({ rep_suitability: v })} />
      </Section>
      <Section title="Športy">
        <Chips options={enums.sport_tags ?? []} value={ex.data.sport_tags ?? []} onChange={(v) => setData({ sport_tags: v })} />
      </Section>
      <Section title="Nevhodné pri zranení">
        <Chips options={enums.contraindications ?? []} value={ex.data.contraindications ?? []} onChange={(v) => setData({ contraindications: v })} />
      </Section>
      <Section title="Kategória vo výbere">
        <Chips options={enums.categories ?? []} value={ex.categories} onChange={(v) => setEx({ ...ex, categories: v })} />
      </Section>

      <label className="flex items-center gap-2 text-xs text-gray-300">
        <input type="checkbox" checked={ex.active} onChange={(e) => setEx({ ...ex, active: e.target.checked })} />
        Aktívny (vypnutý sa nedá vybrať, staré zápisy ho ďalej ukážu)
      </label>

      {error && <div className="p-2 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-xs">{error}</div>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-black uppercase tracking-widest px-5 py-2.5 rounded-xl disabled:opacity-40"
        >
          {saving ? "Ukladám…" : "Uložiť cvik"}
        </button>
        <button type="button" onClick={onClose} className="text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400">
          Zavrieť
        </button>
      </div>

      <AssistantChat exercise={ex} onUseProposal={useProposal} />
    </div>
  );
}

/* ---------- návrh od usera ---------- */

function SuggestionRow({
  s,
  exercises,
  onCreate,
  onResolved,
}: {
  s: Suggestion;
  exercises: Exercise[];
  onCreate: (s: Suggestion) => void;
  onResolved: (s: Suggestion) => void;
}) {
  const [open, setOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState(s.exercise_id ?? "");
  const [notify, setNotify] = useState(!s.notified_at);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const st = STATUS[s.status] ?? STATUS.new;

  const resolve = async (status: "approved" | "rejected") => {
    if (status === "approved" && !exerciseId) {
      setInfo("Vyber cvik z katalógu alebo ho najprv vytvor.");
      return;
    }
    setBusy(true);
    setInfo(null);
    try {
      const res: any = await resolveExerciseSuggestion(s.id, {
        status,
        exercise_id: status === "approved" ? exerciseId : null,
        notify,
        message: message.trim() || null,
      });
      if (!res?.success) {
        setInfo(errText(res?.error_code));
        return;
      }
      const ch = res.data.notified;
      setInfo(ch === "push" ? "Uložené, autor dostal push." : ch === "email" ? "Uložené, autor dostal e-mail." : "Uložené.");
      onResolved(res.data.item as Suggestion);
    } catch (e: any) {
      setInfo(e?.message || "Chyba");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-xl border bg-black/30 ${open ? "border-violet-800" : "border-gray-800"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/40 rounded-xl">
        <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm text-white truncate">{s.name}</div>
          <div className="text-[11px] text-gray-500 truncate">
            {s.user_name || s.user_email || `#${s.user_id}`}
            {s.created_at ? ` · ${new Date(s.created_at).toLocaleDateString("sk-SK")}` : ""}
            {s.muscles?.length ? ` · ${s.muscles.map(L).join(", ")}` : ""}
          </div>
        </div>
        <span className={`shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">
          <div className="text-xs text-gray-300 space-y-1">
            <div>Autor: {s.user_name || "—"} · {s.user_email || `#${s.user_id}`}</div>
            <div>
              Meranie: {L(s.measure || "reps")} · Váha: {L(s.load_mode || "external")}
              {s.equipment?.length ? ` · Vybavenie: ${s.equipment.join(", ")}` : ""}
            </div>
            {s.notes ? <div className="text-gray-400">Poznámka: {s.notes}</div> : null}
            {s.notified_at ? <div className="text-gray-500">Upozornený {new Date(s.notified_at).toLocaleString("sk-SK")}</div> : null}
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <button
              type="button"
              onClick={() => onCreate(s)}
              className="bg-violet-600/30 border border-violet-500/60 text-violet-100 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg"
            >
              + Vytvoriť cvik z návrhu
            </button>
            <label className="flex flex-col gap-1 text-xs flex-1 min-w-[200px]">
              <span className="text-gray-500">alebo cvik v katalógu</span>
              <select
                value={exerciseId}
                onChange={(e) => setExerciseId(e.target.value)}
                className="bg-black/40 border border-gray-800 rounded-lg px-2 py-1.5 text-white outline-none"
              >
                <option value="">—</option>
                {exercises.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.names.sk} ({e.id})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Upozorniť autora (push, bez povolených notifikácií e-mail)
          </label>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Doplnok k správe (voliteľné) – napr. prečo sme ho nepridali"
            className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => resolve("approved")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg disabled:opacity-40"
            >
              ✓ Pridaný do katalógu
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => resolve("rejected")}
              className="border border-gray-700 text-gray-300 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg disabled:opacity-40"
            >
              Zamietnuť
            </button>
          </div>
          {info && <div className="text-xs text-gray-300">{info}</div>}
        </div>
      )}
    </div>
  );
}

/* ---------- panel ---------- */

export default function StrengthCatalogPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<"suggestions" | "exercises">("suggestions");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [enums, setEnums] = useState<Enums>({});
  const [migrated, setMigrated] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [editing, setEditing] = useState<{ ex: Exercise; isNew: boolean; fromSuggestion?: number } | null>(null);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  // vybavené návrhy ostávajú v DB (história), v zozname predvolene len nové
  const [sugFilter, setSugFilter] = useState<"new" | "done" | "all">("new");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ex, sug]: any[] = await Promise.all([getCatalogExercises(), getExerciseSuggestions()]);
      if (ex?.success) {
        setExercises(ex.data.items ?? []);
        setEnums(ex.data.enums ?? {});
        setMigrated(!!ex.data.migrated);
      } else setError(errText(ex?.error_code));
      if (sug?.success) setSuggestions(sug.data.items ?? []);
    } catch (e: any) {
      setError(e?.message || "Nepodarilo sa načítať katalóg.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !exercises.length && !loading) void load();
  };

  const newCount = suggestions.filter((s) => s.status === "new").length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return exercises.filter((e) => {
      if (!showInactive && !e.active) return false;
      if (!needle) return true;
      return `${e.id} ${e.names.sk} ${e.names.cs} ${e.names.en}`.toLowerCase().includes(needle);
    });
  }, [exercises, q, showInactive]);

  const fromSuggestion = (s: Suggestion) => {
    const ex = emptyExercise();
    ex.names = { sk: s.name, cs: "", en: "" };
    ex.id = slug(s.name);
    ex.data.measure = s.measure || "reps";
    ex.data.load_mode = s.load_mode || "external";
    ex.data.equipment = (s.equipment ?? []).filter((e) => (enums.equipment ?? []).includes(e));
    s.muscles?.forEach((m, i) => (ex.muscles[m] = i === 0 ? 1 : 0.5));
    setEditing({ ex, isNew: true, fromSuggestion: s.id });
    setTab("exercises");
  };

  const onSaved = (saved: Exercise) => {
    setExercises((prev) => {
      const i = prev.findIndex((e) => e.id === saved.id);
      if (i < 0) return [...prev, saved];
      const next = [...prev];
      next[i] = saved;
      return next;
    });
    // nový cvik z návrhu – v návrhu sa rovno ponúkne na priradenie
    if (editing?.fromSuggestion) {
      setSuggestions((prev) => prev.map((s) => (s.id === editing.fromSuggestion ? { ...s, exercise_id: saved.id } : s)));
      setTab("suggestions");
    }
    setEditing(null);
  };

  const tabBtn = (key: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${
        tab === key ? "border-violet-500 bg-violet-900/40 text-violet-200" : "border-gray-800 bg-gray-900 text-gray-500"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-gray-900 border-t-4 border-violet-500 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      <div className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors" onClick={toggle}>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-white uppercase italic">
            <span className="text-violet-500 mr-3">🏋️</span> Katalóg cvikov
          </h2>
          {newCount > 0 && (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-violet-900/40 text-violet-300">
              {newCount} {newCount === 1 ? "nový návrh" : "nové návrhy"}
            </span>
          )}
        </div>
        <div className={`text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : "rotate-0"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 md:p-8 space-y-4 border-t border-gray-800">
          <div className="flex flex-wrap items-center gap-2">
            {tabBtn("suggestions", `Návrhy userov${newCount ? ` (${newCount})` : ""}`)}
            {tabBtn("exercises", `Cviky (${exercises.length})`)}
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="ml-auto bg-violet-600/20 border border-violet-600/50 text-violet-300 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {loading ? "🔄 Načítavam…" : "🔄 Obnoviť"}
            </button>
          </div>

          {!migrated && (
            <div className="p-3 rounded-lg bg-amber-900/30 border border-amber-700/50 text-amber-200 text-xs">
              Tabuľka strength_exercises je prázdna – spusti migráciu Backend/sql/strength_exercises.sql (nahrá aj všetky
              cviky z kódu). Dovtedy appka používa katalóg z kódu.
            </div>
          )}
          {error && <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-xs">{error}</div>}

          {tab === "suggestions" && (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                {(
                  [
                    ["new", `Nové (${newCount})`],
                    ["done", `Vybavené (${suggestions.length - newCount})`],
                    ["all", "Všetky"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSugFilter(k)}
                    className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                      sugFilter === k
                        ? "bg-violet-600/30 border-violet-500 text-violet-200"
                        : "border-gray-700 text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {suggestions
                .filter((s) => sugFilter === "all" || (sugFilter === "new") === (s.status === "new"))
                .map((s) => (
                <SuggestionRow
                  key={s.id}
                  s={s}
                  exercises={exercises.filter((e) => e.active)}
                  onCreate={fromSuggestion}
                  onResolved={(saved) => setSuggestions((prev) => prev.map((x) => (x.id === saved.id ? { ...x, ...saved } : x)))}
                />
              ))}
              {!loading &&
                !suggestions.some((s) => sugFilter === "all" || (sugFilter === "new") === (s.status === "new")) && (
                  <div className="text-xs text-gray-500">{sugFilter === "new" ? "Žiadne nové návrhy." : "Zatiaľ žiadne návrhy."}</div>
                )}
            </div>
          )}

          {tab === "exercises" && (
            <div className="space-y-3">
              {editing ? (
                <ExerciseEditor
                  key={editing.ex.id || "new"}
                  initial={editing.ex}
                  isNew={editing.isNew}
                  enums={enums}
                  onSaved={onSaved}
                  onClose={() => setEditing(null)}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing({ ex: emptyExercise(), isNew: true })}
                    className="bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg"
                  >
                    + Nový cvik
                  </button>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Hľadať názov / ID"
                    className="flex-1 min-w-[180px] bg-black/40 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-violet-600"
                  />
                  <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                    aj vypnuté
                  </label>
                </div>
              )}
              {!editing && (
                <div className="space-y-1.5">
                  {filtered.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setEditing({ ex: { ...emptyExercise(), ...e, data: { ...emptyExercise().data, ...e.data } }, isNew: false })}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-800 bg-black/30 hover:bg-gray-800/40 text-left"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${e.active ? "bg-emerald-400" : "bg-gray-600"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate">{e.names.sk}</div>
                        <div className="text-[11px] text-gray-500 truncate font-mono">
                          {e.id} · {e.data.pattern} · {Object.keys(e.muscles || {}).map(L).join(", ")}
                        </div>
                      </div>
                    </button>
                  ))}
                  {!loading && filtered.length === 0 && <div className="text-xs text-gray-500">Nič sa nenašlo.</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
