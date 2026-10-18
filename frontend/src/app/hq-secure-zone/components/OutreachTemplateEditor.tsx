"use client";
import { useEffect, useState } from "react";
import { getOutreachTemplates, saveOutreachTemplates } from "../actions";

// Úprava predlohy pripomienkového mailu (SK/CS/EN) – ukladá sa do app_settings,
// návrh pre každého usera sa z nej skladá na BE (Services/admin_outreach.py).

type Lang = "sk" | "cs" | "en";
type Templates = Record<Lang, Record<string, string>>;

const LANGS: Array<[Lang, string]> = [
  ["sk", "SK"],
  ["cs", "CS"],
  ["en", "EN"],
];

const FIELDS: Array<{ key: string; label: string; rows: number }> = [
  { key: "subject", label: "Predmet", rows: 1 },
  { key: "body", label: "Text mailu", rows: 16 },
  { key: "steps_intro", label: "Úvod k chýbajúcim krokom ({kroky})", rows: 2 },
  { key: "step_profile", label: "Krok: zameranie", rows: 2 },
  { key: "step_strava", label: "Krok: Strava", rows: 2 },
  { key: "step_goal", label: "Krok: cieľ a čas", rows: 2 },
  { key: "step_strength_log", label: "Krok: prvý silový zápis (profil Posilňovanie)", rows: 2 },
  { key: "nothing_missing", label: "Keď userovi nič nechýba (namiesto krokov)", rows: 2 },
];

export default function OutreachTemplateEditor({ onSaved }: { onSaved?: () => void }) {
  const [lang, setLang] = useState<Lang>("sk");
  const [tpl, setTpl] = useState<Templates | null>(null);
  const [defaults, setDefaults] = useState<Templates | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    getOutreachTemplates()
      .then((res: any) => {
        if (!alive) return;
        if (res?.success) {
          setTpl(res.templates);
          setDefaults(res.defaults);
        } else {
          setNotice({ ok: false, text: `Predlohu sa nepodarilo načítať (${res?.error_code ?? "chyba"}).` });
        }
      })
      .catch(() => alive && setNotice({ ok: false, text: "Predlohu sa nepodarilo načítať." }));
    return () => {
      alive = false;
    };
  }, []);

  const save = async (next: Templates) => {
    setSaving(true);
    setNotice(null);
    const res: any = await saveOutreachTemplates(next).catch(() => null);
    if (res?.success) {
      setTpl(res.templates);
      setNotice({ ok: true, text: "Predloha uložená ✓ – nové návrhy už idú podľa nej." });
      onSaved?.();
    } else {
      setNotice({ ok: false, text: `Uloženie zlyhalo (${res?.error_code ?? "chyba"}).` });
    }
    setSaving(false);
  };

  const resetLang = () => {
    if (!tpl || !defaults) return;
    if (!window.confirm(`Vrátiť pôvodnú predlohu pre ${lang.toUpperCase()}?`)) return;
    void save({ ...tpl, [lang]: { ...defaults[lang] } });
  };

  if (!tpl) {
    return <div className="text-xs text-gray-400">{notice?.text ?? "Načítavam predlohu…"}</div>;
  }

  const cur = tpl[lang] ?? {};
  const set = (key: string, value: string) => setTpl({ ...tpl, [lang]: { ...cur, [key]: value } });

  return (
    <div className="rounded-xl border border-gray-700 bg-black/40 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-black uppercase tracking-widest text-white">Predloha mailu</div>
        <div className="flex gap-1.5">
          {LANGS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setLang(key)}
              className={`text-[10px] font-black px-3 py-1.5 rounded-lg border ${
                lang === key ? "border-lime-400 bg-lime-900/30 text-lime-300" : "border-gray-800 text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Premenné: <b className="text-gray-200">{"{meno}"}</b> = krstné meno (ak ho user nemá, zmizne aj s čiarkou),{" "}
        <b className="text-gray-200">{"{kroky}"}</b> = úvod a zoznam toho, čo userovi chýba,{" "}
        <b className="text-gray-200">{"{odkaz}"}</b> = adresa appky. Jazyk mailu sa vyberá podľa jazyka appky usera.
      </p>

      {FIELDS.map((f) => (
        <label key={f.key} className="block space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{f.label}</span>
          {f.rows === 1 ? (
            <input
              value={cur[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-lime-500"
            />
          ) : (
            <textarea
              value={cur[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              rows={f.rows}
              className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white leading-relaxed outline-none focus:border-lime-500"
            />
          )}
        </label>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => save(tpl)}
          disabled={saving}
          className="bg-lime-400 text-black text-xs font-black uppercase tracking-widest px-5 py-2.5 rounded-lg disabled:opacity-40"
        >
          {saving ? "Ukladám…" : "Uložiť predlohu"}
        </button>
        <button
          onClick={resetLang}
          disabled={saving}
          className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border border-gray-800 text-gray-400 hover:text-gray-200"
        >
          Vrátiť pôvodnú ({lang.toUpperCase()})
        </button>
      </div>

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
  );
}
