"use client";
import { useMemo, useState, type ReactNode } from "react";
import { triggerMaintenanceTask } from "../actions";

// Admin prehľad userov – čo si kto nastavil, čo robí a kedy naposledy.
// Dáta skladá BE task "user-overview" (Services/user_overview.py).

type Status = "registered" | "active" | "quiet" | "inactive";

type OverviewUser = {
  id: number;
  email: string;
  name: string;
  registered_at: string | null;
  last_sign_in_at: string | null;
  providers: string[];
  status: Status;
  tier: string;
  strava: boolean;
  intervals: boolean;
  push: string[];
  app: {
    last_seen_at: string | null;
    last_standalone_at: string | null;
    platform: string | null;
    platforms: Record<string, string>;
  };
  profile: string | null;
  widgets_custom: boolean;
  coach: { mode: string; goal: string | null; sports: string[]; races: number } | null;
  templates: number;
  bio_filled: boolean;
  prefs_updated: Record<string, string | null>;
  plan: {
    status: string | null;
    start_date: string | null;
    end_date: string | null;
    next7: number;
    done30: number;
    last_change_at: string | null;
    plans_total: number;
  };
  activities30: number;
  last_activity_date: string | null;
  strength_total: number;
  strength30: number;
  strength_last_at: string | null;
  recovery30: number;
  recovery_last: string | null;
  health_total: number;
  health_last_at: string | null;
  ai_own30: number;
  ai_own_last_at: string | null;
  ai_welcome: number;
  last_action_at: string | null;
};

type Overview = {
  summary: Record<string, number>;
  users: OverviewUser[];
  window_days: number;
  generated_at: string;
};

type Filter = "all" | "new" | Status;

const STATUS: Record<Status, { label: string; dot: string; text: string }> = {
  active: { label: "Aktívny", dot: "bg-emerald-400", text: "text-emerald-400" },
  quiet: { label: "Tichý 8–30 dní", dot: "bg-yellow-400", text: "text-yellow-400" },
  inactive: { label: "Neaktívny 30+ dní", dot: "bg-red-500", text: "text-red-400" },
  registered: { label: "Len registrácia", dot: "bg-gray-500", text: "text-gray-400" },
};

const PROFILE: Record<string, string> = {
  strength: "Posilňovanie",
  endurance: "Beh a trail",
  hybrid: "Beh + sila",
  ocr: "OCR a Hyrox",
  health: "Zdravie",
  all: "Všetko",
};

const GOAL: Record<string, string> = {
  lose_weight: "schudnúť",
  health: "zdravie",
  maintain: "udržať formu",
  improve_endurance: "vytrvalosť",
  improve_speed: "rýchlosť",
  improve_overall: "celková kondícia",
};

const SPORT: Record<string, string> = {
  run: "beh",
  trail: "trail",
  bike: "bicykel",
  ride: "bicykel",
  swim: "plávanie",
  strength: "sila",
};

const PLATFORM: Record<string, string> = { ios: "iPhone", android: "Android", desktop: "PC" };
const PUSH: Record<string, string> = { apple: "Apple", chrome: "Chrome/Android", firefox: "Firefox", edge: "Edge", other: "iné" };

const DAY = 24 * 60 * 60 * 1000;

function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // kalendárne dni, nie 24 h – večer včera nie je „dnes“
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / DAY);
  const date = d.toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" });
  if (days <= 0) return `dnes (${date})`;
  if (days === 1) return `včera (${date})`;
  return `pred ${days} d (${date})`;
}

function dateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" });
}

function Chip({ on, children, title }: { on: boolean; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
        on ? "border-emerald-700/60 bg-emerald-900/30 text-emerald-300" : "border-gray-800 bg-gray-900 text-gray-600"
      }`}
    >
      {children}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 text-xs leading-relaxed">
      <span className="w-24 shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 text-gray-200">{children}</span>
    </div>
  );
}

function UserCard({ u }: { u: OverviewUser }) {
  const st = STATUS[u.status] ?? STATUS.registered;
  const providers = u.providers.length ? u.providers.map((p) => (p === "email" ? "e-mail" : p)).join(" + ") : "—";
  const coach = u.coach;
  const plan = u.plan;
  const seenPlatforms = Object.keys(u.app.platforms || {}).map((p) => PLATFORM[p] ?? p).join(", ");

  return (
    <div className="rounded-xl border border-gray-800 bg-black/30 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.dot}`} />
            <span className="font-bold text-sm text-white break-all">{u.email || `#${u.id}`}</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            #{u.id}
            {u.name ? ` · ${u.name}` : ""} · registrácia {ago(u.registered_at)} · {providers}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black uppercase tracking-widest ${st.text}`}>{st.label}</span>
          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-300">{u.tier}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip on={u.strava}>Strava</Chip>
        <Chip on={!!u.app.last_standalone_at} title="otvoril appku z plochy">
          PWA{u.app.last_standalone_at ? ` ${dateOnly(u.app.last_standalone_at)}` : ""}
        </Chip>
        <Chip on={u.push.length > 0}>Push{u.push.length ? `: ${u.push.map((p) => PUSH[p] ?? p).join(", ")}` : ""}</Chip>
        <Chip on={u.intervals}>intervals.icu</Chip>
        <Chip on={u.bio_filled}>Bio</Chip>
        <Chip on={u.widgets_custom}>Vlastné widgety</Chip>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
        <Row label="Zameranie">{u.profile ? PROFILE[u.profile] ?? u.profile : <span className="text-gray-500">nevybrané</span>}</Row>
        <Row label="Režim">
          {coach ? (coach.mode === "advisor" ? "AI tréner · Poradca" : "AI tréner · Coach") : <span className="text-gray-500">coach prefs neuložené</span>}
        </Row>
        <Row label="Cieľ / šport">
          {coach
            ? [
                coach.goal ? GOAL[coach.goal] ?? coach.goal : "cieľ nezadaný",
                coach.sports.length ? coach.sports.map((s) => SPORT[s] ?? s).join(", ") : null,
                coach.races ? `${coach.races}× pretek` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "—"}
        </Row>
        <Row label="Plán">
          {plan.status ? (
            <>
              {plan.status === "active" ? "beží" : "vygenerovaný, nespustený"} {dateOnly(plan.start_date)}–{dateOnly(plan.end_date)} · na 7 dní{" "}
              {plan.next7} · splnené {plan.done30}
            </>
          ) : (
            <span className="text-gray-500">{plan.plans_total ? `žiadny bežiaci (${plan.plans_total} v histórii)` : "nikdy"}</span>
          )}
        </Row>
        <Row label="Aktivity 30 d">
          Strava {u.activities30}
          {u.last_activity_date ? ` (posledná ${dateOnly(u.last_activity_date)})` : ""} · sila {u.strength30}/{u.strength_total} · recovery{" "}
          {u.recovery30} · zdravie {u.health_total}
        </Row>
        <Row label="AI">
          vlastné požiadavky {u.ai_own30} (30 d){u.ai_own_last_at ? `, posledná ${ago(u.ai_own_last_at)}` : ""}
          {u.ai_welcome ? ` · uvítacie ${u.ai_welcome}` : ""}
          {u.templates ? ` · šablóny ${u.templates}` : ""}
        </Row>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-gray-800">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Posledný vlastný zásah</div>
          <div className="text-xs font-bold text-white">{ago(u.last_action_at)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Posledné otvorenie appky</div>
          <div className="text-xs font-bold text-white">
            {ago(u.app.last_seen_at)}
            {seenPlatforms ? <span className="font-normal text-gray-400"> · {seenPlatforms}</span> : null}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Posledné prihlásenie</div>
          <div className="text-xs font-bold text-white">{ago(u.last_sign_in_at)}</div>
        </div>
      </div>
    </div>
  );
}

export default function UserOverviewPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  // veľa dotazov naprieč tabuľkami – načíta sa až po otvorení
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await triggerMaintenanceTask("user-overview");
      setData((json?.data as Overview) ?? null);
    } catch (e: any) {
      setError(e?.message || "Nepodarilo sa načítať prehľad userov.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !data && !loading) void load();
  };

  const users = useMemo(() => {
    const all = data?.users ?? [];
    const weekAgo = Date.now() - 7 * DAY;
    const needle = q.trim().toLowerCase();
    return all.filter((u) => {
      if (filter === "new" && !(u.registered_at && new Date(u.registered_at).getTime() >= weekAgo)) return false;
      if (filter !== "all" && filter !== "new" && u.status !== filter) return false;
      if (needle && !`${u.email} ${u.name} ${u.id}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, filter, q]);

  const s = data?.summary ?? {};
  const tiles: Array<[string, number | undefined]> = [
    ["Userov", s.users],
    ["Noví 7 dní", s.new7],
    ["Aktívni 7 dní", s.active7],
    ["Len registrácia", s.only_registered],
    ["So zameraním", s.with_profile],
    ["S plánom", s.with_plan],
    ["Poradca", s.advisor],
    ["Strava", s.strava],
    ["PWA z plochy", s.pwa],
    ["Push", s.push],
  ];
  const filters: Array<[Filter, string]> = [
    ["all", "Všetci"],
    ["new", "Noví 7 dní"],
    ["registered", "Len registrácia"],
    ["active", "Aktívni"],
    ["quiet", "Tichí"],
    ["inactive", "Neaktívni"],
  ];

  return (
    <div className="bg-gray-900 border-t-4 border-sky-500 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      <div
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-white uppercase italic">
            <span className="text-sky-500 mr-3">👥</span> Prehľad userov
          </h2>
          {!isOpen && data && (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-sky-900/30 text-sky-400 hidden sm:inline-block">
              {s.active7 ?? 0} aktívnych · {s.only_registered ?? 0} len registrácia
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
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="bg-sky-600/20 border border-sky-600/50 hover:bg-sky-600/40 text-sky-300 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all disabled:opacity-50"
            >
              {loading ? "🔄 Načítavam..." : "🔄 Obnoviť"}
            </button>
            {data?.generated_at && (
              <span className="text-[10px] text-gray-500">{new Date(data.generated_at).toLocaleString("sk-SK")}</span>
            )}
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            <b className="text-gray-300">Vlastný zásah</b> = niečo, čo urobil sám: uložil nastavenia (zameranie, ciele, šablóny,
            jazyk/notifikácie), zapísal silový tréning, zdravie alebo ručné recovery, alebo si vyžiadal niečo od AI. Plán a aktivity
            zo Stravy sa nerátajú (mení ich aj AI / prídu samé). <b className="text-gray-300">Otvorenie appky</b> a{" "}
            <b className="text-gray-300">PWA</b> sa zaznamenávajú až od nasadenia sledovania – „—“ u starších userov znamená, že
            odvtedy appku neotvorili. Push „Apple“ = Safari – na iPhone sa dá zapnúť len v appke z plochy.
          </p>

          {error && <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-xs">{error}</div>}

          {data && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {tiles.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-gray-800 bg-black/30 px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</div>
                    <div className="text-2xl font-black text-white">{value ?? 0}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {filters.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
                      filter === key
                        ? "border-sky-500 bg-sky-900/40 text-sky-300"
                        : "border-gray-800 bg-gray-900 text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Hľadať e-mail / meno / ID"
                  className="flex-1 min-w-[180px] bg-black/40 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-sky-600"
                />
              </div>

              <div className="space-y-3">
                {users.map((u) => (
                  <UserCard key={u.id} u={u} />
                ))}
                {users.length === 0 && <div className="text-xs text-gray-500">Nikto nezodpovedá filtru.</div>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
