"use client";
import { useMemo, useState } from "react";
import { getOutreachCandidates, getOutreachDraft, sendOutreachEmail } from "../actions";
import OutreachTemplateEditor from "./OutreachTemplateEditor";
import ZohoConnectBox from "./ZohoConnectBox";

// Pripomienkový e-mail pre userov, ktorí sa len zaregistrovali.
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
};

type Draft = {
  user_id: number;
  to: string;
  name: string;
  lang: string;
  missing: string[];
  subject: string;
  body: string;
  sent_at: string | null;
};

const MISSING: Record<string, string> = {
  profile: "zameranie",
  strava: "Strava",
  goal: "cieľ",
  strength_log: "silový zápis",
};

const ERRORS: Record<string, string> = {
  already_sent: "Tento user už pripomienku dostal – zaškrtni „Poslať znova“.",
  email_not_configured: "Na BE nie je nastavené odosielanie mailov – napoj Zoho Mail (🔌). Mail sa neodoslal.",
  send_failed: "Odoslanie zlyhalo – pozri log BE (riadok [EMAIL]).",
  invalid_recipient: "User nemá platný e-mail.",
  empty_message: "Predmet aj text musia byť vyplnené.",
  user_not_found: "User sa nenašiel.",
};

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

  const send = async () => {
    if (!draft || sending) return;
    if (!window.confirm(`Odoslať e-mail na ${draft.to}?`)) return;
    setSending(true);
    setNotice(null);
    const res: any = await sendOutreachEmail(draft.user_id, subject, body, force).catch(() => null);
    if (res?.success) {
      setNotice({ ok: true, text: `Odoslané na ${draft.to} ✓` });
      setDraft({ ...draft, sent_at: res.sent_at ?? new Date().toISOString() });
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
    <div className="bg-gray-900 border-t-4 border-lime-400 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      <div
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-white uppercase italic">
            <span className="text-lime-400 mr-3">📧</span> Pripomienky
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
            <b className="text-gray-300">Na pripomienku</b> = zaregistrovaný aspoň 24 h (najviac 30 dní), nič si nenastavil ani
            nezapísal a pripomienku ešte nedostal. Vyber usera, návrh mailu sa načíta v jeho jazyku s menom a tým, čo mu chýba.
            Uprav ho a odošli – ide z noreply@selfrace.com, odpovede na support@selfrace.com. Každý user ho dostane len raz.
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

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {list.map((u) => (
              <button
                key={u.id}
                onClick={() => pick(u.id)}
                className={`w-full text-left rounded-xl border px-3 py-2 transition-all ${
                  draft?.user_id === u.id ? "border-lime-400 bg-lime-900/20" : "border-gray-800 bg-black/30 hover:border-gray-600"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white break-all">{u.email || `#${u.id}`}</span>
                  {u.sent_at ? (
                    <span className="text-[10px] font-black uppercase text-lime-300">📧 poslané {dateOnly(u.sent_at)}</span>
                  ) : u.candidate ? (
                    <span className="text-[10px] font-black uppercase text-yellow-300">čaká na pripomienku</span>
                  ) : null}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  #{u.id}
                  {u.name ? ` · ${u.name}` : ""} · registrácia {dateOnly(u.registered_at)}
                  {u.missing.length ? ` · chýba: ${u.missing.map((m) => MISSING[m] ?? m).join(", ")}` : ""}
                </div>
              </button>
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
                {draft.missing.length ? ` · chýba: ${draft.missing.map((m) => MISSING[m] ?? m).join(", ")}` : ""}
              </div>
              {draft.sent_at && (
                <label className="flex items-center gap-2 text-xs text-yellow-200">
                  <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                  Pripomienku už dostal {dateOnly(draft.sent_at)} – poslať znova
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
                  disabled={sending || !smtp || !subject.trim() || !body.trim() || (!!draft.sent_at && !force)}
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
