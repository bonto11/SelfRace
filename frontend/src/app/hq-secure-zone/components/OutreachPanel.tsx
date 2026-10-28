"use client";
import { useMemo, useState } from "react";
import { getOutreachCandidates, getOutreachDraft, sendOutreachBulk, sendOutreachEmail } from "../actions";
import OutreachTemplateEditor from "./OutreachTemplateEditor";
import ZohoConnectBox from "./ZohoConnectBox";

// Pripomienkový e-mail: čerstvo registrovaní (nudge) aj tí, čo dlhšie nechodia (comeback).
// Návrh skladá BE (Services/admin_outreach.py) v jazyku usera, admin ho upraví a odošle.
// Odoslanie sa zapíše k userovi (admin.outreach) – druhýkrát len s „Poslať znova“.

type OutreachUser = {
  id: number;
  email: string;
  name: string;
  status: string;
  registered_at: string | null;
  missing: string[];
  sent_at: string | null;
  candidate: boolean;
  reason: "nudge" | "comeback" | null;
  inactive_days: number | null;
};

type Draft = {
  user_id: number;
  to: string;
  name: string;
  lang: string;
  missing: string[];
  steps: string[];
  subject: string;
  body: string;
  sent_at: string | null;
  reason: "nudge" | "comeback" | null;
  kind: "nudge" | "comeback";
  inactive_days: number | null;
  /** mail za posledných 60 dní – znova len so „Poslať znova“ */
  recently_sent: boolean;
};

const MISSING: Record<string, string> = {
  profile: "zameranie",
  strava: "Strava",
  goal: "cieľ",
  strength_log: "silový zápis",
};

const ERRORS: Record<string, string> = {
  already_sent: "Tento user dostal mail za posledných 60 dní – zaškrtni „Poslať znova“.",
  email_not_configured: "Na BE nie je nastavené odosielanie mailov – napoj Zoho Mail (🔌). Mail sa neodoslal.",
  send_failed: "Odoslanie zlyhalo – pozri log BE (riadok [EMAIL]).",
  invalid_recipient: "User nemá platný e-mail.",
  empty_message: "Predmet aj text musia byť vyplnené.",
  user_not_found: "User sa nenašiel.",
};

// čo sa dá do mailu zaškrtnúť (kľúče = STEP_KEYS na BE)
const STEPS: Array<[string, string]> = [
  ["profile", "Zameranie"],
  ["strava", "Strava"],
  ["goal", "Cieľ a čas"],
  ["strength_log", "Prvý silový zápis"],
  ["comeback", "„Dlhšie som ťa nevidel“"],
  ["follow", "Follow na Instagram / FB"],
];

const PROVIDERS: Record<string, string> = {
  zoho: "Zoho Mail (API)",
  resend: "Resend",
  zeptomail: "ZeptoMail",
  smtp: "SMTP",
};

const errText = (code?: string) => (code && ERRORS[code]) || `Chyba: ${code || "neznáma"}`;

function dateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" });
}

export default function OutreachPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<OutreachUser[] | null>(null);
  const [smtp, setSmtp] = useState(true);
  const [onlyCandidates, setOnlyCandidates] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [force, setForce] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [editTemplate, setEditTemplate] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [zohoMissing, setZohoMissing] = useState<string[]>([]);
  const [zohoOpen, setZohoOpen] = useState(false);

  // hromadné odoslanie: vybraní useri + bloky (null = každému to, čo mu chýba)
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkSteps, setBulkSteps] = useState<string[] | null>(null);
  const [bulkForce, setBulkForce] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const toggleSelected = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sendBulk = async () => {
    const ids = Array.from(selected);
    if (!ids.length || bulkSending) return;
    if (ids.length > 50) {
      setBulkResult("Naraz najviac 50 userov.");
      return;
    }
    if (!window.confirm(`Odoslať e-mail ${ids.length} userom? Každý dostane mail vo svojom jazyku so svojím menom.`)) return;
    setBulkSending(true);
    setBulkResult(null);
    const res: any = await sendOutreachBulk(ids, bulkSteps, bulkForce).catch(() => null);
    if (res?.success) {
      const failed = (res.results ?? []).filter((r: any) => !r.ok);
      setBulkResult(
        `Odoslané: ${res.sent}` +
          (failed.length
            ? ` · neodoslané: ${failed.map((r: any) => `${r.email || "#" + r.user_id} (${errText(r.code)})`).join(", ")}`
            : " ✓"),
      );
      setSelected(new Set());
      setBulkForce(false);
      void load();
    } else {
      setBulkResult(errText(res?.error_code));
    }
    setBulkSending(false);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    const res: any = await getOutreachCandidates().catch(() => null);
    if (res?.success) {
      setUsers(res.users ?? []);
      setSmtp(!!res.smtp);
      setProvider(res.provider ?? null);
      setZohoMissing(Array.isArray(res.zoho_missing) ? res.zoho_missing : []);
    } else {
      setError(errText(res?.error_code));
    }
    setLoading(false);
  };

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !users && !loading) void load();
  };

  const pick = async (userId: number) => {
    setDraftLoading(true);
    setNotice(null);
    setForce(false);
    const res: any = await getOutreachDraft(userId).catch(() => null);
    if (res?.success) {
      setDraft(res as Draft);
      setSubject(res.subject ?? "");
      setBody(res.body ?? "");
      setSmtp(!!res.smtp);
      setProvider(res.provider ?? null);
      setZohoMissing(Array.isArray(res.zoho_missing) ? res.zoho_missing : []);
    } else {
      setNotice({ ok: false, text: errText(res?.error_code) });
    }
    setDraftLoading(false);
  };

  // zmena zaškrtnutia poskladá text návrhu nanovo (ručné úpravy textu sa prepíšu)
  const [rebuilding, setRebuilding] = useState(false);
  const toggleStep = async (key: string) => {
    if (!draft || rebuilding) return;
    const next = draft.steps.includes(key) ? draft.steps.filter((k) => k !== key) : [...draft.steps, key];
    setRebuilding(true);
    const res: any = await getOutreachDraft(draft.user_id, next).catch(() => null);
    if (res?.success) {
      setDraft(res as Draft);
      setSubject(res.subject ?? "");
      setBody(res.body ?? "");
    } else {
      setNotice({ ok: false, text: errText(res?.error_code) });
    }
    setRebuilding(false);
  };

  const send = async () => {
    if (!draft || sending) return;
    if (!window.confirm(`Odoslať e-mail na ${draft.to}?`)) return;
    setSending(true);
    setNotice(null);
    const res: any = await sendOutreachEmail(draft.user_id, subject, body, force, draft.kind).catch(() => null);
    if (res?.success) {
      setNotice({ ok: true, text: `Odoslané na ${draft.to} ✓` });
      setDraft({ ...draft, sent_at: res.sent_at ?? new Date().toISOString(), recently_sent: true });
      setForce(false);
      void load();
    } else {
      setNotice({ ok: false, text: errText(res?.error_code) });
    }
    setSending(false);
  };

  const list = useMemo(
    () => (users ?? []).filter((u) => !onlyCandidates || u.candidate),
    [users, onlyCandidates],
  );
  const candidates = (users ?? []).filter((u) => u.candidate).length;

  return (
    <div className="bg-gray-900 border-t-4 border-emerald-500 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      <div
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-white uppercase italic">
            <span className="text-emerald-500 mr-3">📧</span> Pripomienky
          </h2>
          {!isOpen && users && (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-lime-900/30 text-lime-300 hidden sm:inline-block">
              {candidates} na pripomienku
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
        <div className="p-4 md:p-8 space-y-5 border-t border-gray-800">
          <p className="text-xs text-gray-400 leading-relaxed">
            <b className="text-gray-300">Na pripomienku</b> = <b className="text-yellow-300">nový</b> (zaregistrovaný 24 h – 30 dní, nič si
            nenastavil ani nezapísal) alebo <b className="text-sky-300">dlhšie nebol</b> (aspoň 14 dní bez appky – aj starší, čo sa len
            zaregistrovali). Kto dostal mail za posledných 60 dní, nie je na zozname. Vyber usera, návrh mailu sa načíta v jeho
            jazyku s menom a tým, čo mu chýba („dlhšie nebol“ má predmet „ako sa máš“ a vetu „dlhšie som ťa nevidel“). Uprav ho a
            odošli – ide z noreply@selfrace.com, odpovede na support@selfrace.com.
          </p>

          {users && (
            <div className="text-[11px] text-gray-400">
              Odosiela sa cez:{" "}
              <b className={provider === "zoho" ? "text-lime-300" : "text-gray-200"}>
                {PROVIDERS[provider ?? ""] ?? "nenastavené"}
              </b>
              {provider !== "zoho" && zohoMissing.length > 0 && (
                <span className="text-yellow-300">
                  {" "}
                  · Zoho Mail: BE nevidí {zohoMissing.join(", ")} (Railway → Variables, potom reštart)
                </span>
              )}
            </div>
          )}
          {(!smtp || provider === "smtp") && (
            <div className="p-3 rounded-lg bg-yellow-900/30 border border-yellow-700/50 text-yellow-200 text-xs">
              {provider === "smtp"
                ? "Railway blokuje SMTP – maily cez smtp.zoho.eu skončia timeoutom. "
                : "Odosielanie mailov nie je nastavené. "}
              Napoj Zoho Mail cez API (tlačidlo 🔌 Zoho Mail nižšie).
            </div>
          )}
          {error && <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-xs">{error}</div>}

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                [true, `Na pripomienku (${candidates})`],
                [false, `Všetci (${users?.length ?? 0})`],
              ] as const
            ).map(([val, label]) => (
              <button
                key={label}
                onClick={() => setOnlyCandidates(val)}
                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
                  onlyCandidates === val
                    ? "border-lime-400 bg-lime-900/30 text-lime-300"
                    : "border-gray-800 bg-gray-900 text-gray-500 hover:text-gray-300"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={load}
              disabled={loading}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-gray-800 text-gray-400 hover:text-gray-200 disabled:opacity-50"
            >
              {loading ? "🔄 Načítavam..." : "🔄 Obnoviť"}
            </button>
            <button
              onClick={() => setEditTemplate((v) => !v)}
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
                editTemplate ? "border-lime-400 bg-lime-900/30 text-lime-300" : "border-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              ✏️ Upraviť predlohu
            </button>
            <button
              onClick={() => setZohoOpen((v) => !v)}
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
                zohoOpen ? "border-lime-400 bg-lime-900/30 text-lime-300" : "border-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              🔌 Zoho Mail
            </button>
          </div>

          {zohoOpen && <ZohoConnectBox />}

          {/* po uložení predlohy sa otvorený návrh prepíše novou verziou */}
          {editTemplate && <OutreachTemplateEditor onSaved={() => draft && void pick(draft.user_id)} />}

          {users && list.length > 0 && (
            <div className="rounded-xl border border-gray-800 bg-black/30 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                <b className="text-gray-200">Hromadne: vybraných {selected.size}</b>
                <button
                  onClick={() => setSelected(new Set(list.filter((u) => u.candidate).map((u) => u.id).slice(0, 50)))}
                  className="px-2 py-1 rounded border border-gray-800 hover:text-gray-200"
                >
                  Vybrať kandidátov
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="px-2 py-1 rounded border border-gray-800 hover:text-gray-200"
                >
                  Zrušiť výber
                </button>
              </div>
              {selected.size > 0 && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setBulkSteps(null)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                        bulkSteps === null ? "border-lime-400 bg-lime-900/30 text-lime-200" : "border-gray-800 text-gray-500"
                      }`}
                    >
                      {bulkSteps === null ? "☑" : "☐"} Každému podľa toho, čo mu chýba
                    </button>
                    {STEPS.map(([key, label]) => {
                      const on = bulkSteps?.includes(key) ?? false;
                      return (
                        <button
                          key={key}
                          onClick={() =>
                            setBulkSteps((prev) => {
                              const cur = prev ?? [];
                              return cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
                            })
                          }
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                            on ? "border-lime-400 bg-lime-900/30 text-lime-200" : "border-gray-800 text-gray-500"
                          }`}
                        >
                          {on ? "☑" : "☐"} {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Text a predmet sú z predlohy, BE doplní meno a jazyk každého usera („dlhšie nebol“ má predmet „ako sa máš“).
                    Náhľad pre konkrétneho usera uvidíš po kliknutí naňho.
                  </div>
                  <label className="flex items-center gap-2 text-xs text-yellow-200">
                    <input type="checkbox" checked={bulkForce} onChange={(e) => setBulkForce(e.target.checked)} />
                    Poslať aj tým, čo dostali mail za posledných 60 dní
                  </label>
                  <button
                    onClick={sendBulk}
                    disabled={bulkSending || !smtp || (bulkSteps !== null && bulkSteps.length === 0)}
                    className="bg-lime-400 text-black text-xs font-black uppercase tracking-widest px-5 py-2.5 rounded-lg disabled:opacity-40"
                  >
                    {bulkSending ? "Odosielam…" : `Odoslať ${selected.size} mailov`}
                  </button>
                </>
              )}
              {bulkResult && <div className="text-xs text-gray-300">{bulkResult}</div>}
            </div>
          )}

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {list.map((u) => (
              <div key={u.id} className="flex items-stretch gap-2">
              <input
                type="checkbox"
                aria-label={`Vybrať ${u.email}`}
                checked={selected.has(u.id)}
                onChange={() => toggleSelected(u.id)}
                className="shrink-0 w-4 accent-lime-400"
              />
              <button
                onClick={() => pick(u.id)}
                className={`w-full text-left rounded-xl border px-3 py-2 transition-all ${
                  draft?.user_id === u.id ? "border-lime-400 bg-lime-900/20" : "border-gray-800 bg-black/30 hover:border-gray-600"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white break-all">{u.email || `#${u.id}`}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {u.reason === "comeback" ? (
                      <span className="text-[10px] font-black uppercase text-sky-300">
                        💤 dlhšie nebol{u.inactive_days != null ? ` · ${u.inactive_days} d` : ""}
                      </span>
                    ) : u.reason === "nudge" ? (
                      <span className="text-[10px] font-black uppercase text-yellow-300">🆕 nový – čaká na pripomienku</span>
                    ) : null}
                    {u.sent_at ? (
                      <span className="text-[10px] font-black uppercase text-lime-300">📧 poslané {dateOnly(u.sent_at)}</span>
                    ) : null}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  #{u.id}
                  {u.name ? ` · ${u.name}` : ""} · registrácia {dateOnly(u.registered_at)}
                  {u.missing.length ? ` · chýba: ${u.missing.map((m) => MISSING[m] ?? m).join(", ")}` : ""}
                </div>
              </button>
              </div>
            ))}
            {users && list.length === 0 && (
              <div className="text-xs text-gray-500">
                {onlyCandidates ? "Teraz nikto nečaká na pripomienku 🎉" : "Žiadni useri."}
              </div>
            )}
          </div>

          {draftLoading && <div className="text-xs text-gray-400">Pripravujem návrh…</div>}

          {draft && !draftLoading && (
            <div className="rounded-xl border border-gray-700 bg-black/40 p-4 space-y-3">
              <div className="text-xs text-gray-400">
                Komu: <b className="text-white">{draft.to}</b> · jazyk {draft.lang.toUpperCase()}
                {draft.reason === "comeback" ? ` · dlhšie nebol${draft.inactive_days != null ? ` (${draft.inactive_days} d)` : ""}` : ""}
                {draft.missing.length ? ` · chýba: ${draft.missing.map((m) => MISSING[m] ?? m).join(", ")}` : " · nič mu nechýba"}
              </div>
              <div className="space-y-1.5">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Čo do mailu {rebuilding ? "· skladám…" : "· zmena prepíše text"}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STEPS.map(([key, label]) => {
                    const on = draft.steps.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleStep(key)}
                        disabled={rebuilding}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all disabled:opacity-50 ${
                          on ? "border-lime-400 bg-lime-900/30 text-lime-200" : "border-gray-800 text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        {on ? "☑" : "☐"} {label}
                        {draft.missing.includes(key) ? " •" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
              {draft.recently_sent && draft.sent_at && (
                <label className="flex items-center gap-2 text-xs text-yellow-200">
                  <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                  Mail už dostal {dateOnly(draft.sent_at)} – poslať znova
                </label>
              )}
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-lime-500"
                placeholder="Predmet"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={18}
                className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white leading-relaxed outline-none focus:border-lime-500"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={send}
                  disabled={sending || !smtp || !subject.trim() || !body.trim() || (draft.recently_sent && !force)}
                  className="bg-lime-400 text-black text-xs font-black uppercase tracking-widest px-5 py-2.5 rounded-lg disabled:opacity-40"
                >
                  {sending ? "Odosielam…" : "Odoslať e-mail"}
                </button>
                <button
                  onClick={() => pick(draft.user_id)}
                  disabled={sending}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border border-gray-800 text-gray-400 hover:text-gray-200"
                >
                  Vrátiť pôvodný návrh
                </button>
              </div>
            </div>
          )}

          {notice && (
            <div
              className={`p-3 rounded-lg text-xs border ${
                notice.ok ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-200" : "bg-red-900/30 border-red-700/50 text-red-300"
              }`}
            >
              {notice.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
