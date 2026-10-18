"use client";
import { useState } from "react";
import { connectZohoMail } from "../actions";

// Jednorazové napojenie Zoho Mail API (odosielanie mailov z BE cez HTTPS –
// Railway blokuje SMTP). Kód zo Zoho Self Client sa vymení za refresh token,
// ktorý si admin prepíše do Railway. Token sa nikde neukladá.

type Account = { account_id: string; addresses: string[] };

const SCOPE = "ZohoMail.messages.CREATE,ZohoMail.accounts.READ";

const ERRORS: Record<string, string> = {
  zoho_client_missing: "Na Railway chýba ZOHO_CLIENT_ID alebo ZOHO_CLIENT_SECRET (krok 1). Po pridaní počkaj na reštart BE.",
  zoho_code_invalid: "Kód je neplatný alebo vypršal (platí len pár minút) – vygeneruj nový a vlož ho hneď.",
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 break-all rounded-lg bg-black/60 border border-gray-800 px-3 py-2 text-xs text-lime-200">
          {value}
        </code>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => setCopied(true), () => setCopied(false));
          }}
          className="shrink-0 text-[10px] font-black uppercase px-3 py-2 rounded-lg border border-gray-700 text-gray-300"
        >
          {copied ? "✓" : "Kopírovať"}
        </button>
      </div>
    </div>
  );
}

export default function ZohoConnectBox() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ refresh_token: string; accounts: Account[]; sender: string } | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    const res: any = await connectZohoMail(code.trim()).catch(() => null);
    if (res?.success) {
      setResult({ refresh_token: res.refresh_token, accounts: res.accounts ?? [], sender: res.sender ?? "" });
      setCode("");
    } else {
      setError(ERRORS[res?.error_code] ?? `Chyba: ${res?.error_code ?? "neznáma"}`);
    }
    setBusy(false);
  };

  const account = result?.accounts.find((a) => a.addresses.includes(result.sender)) ?? result?.accounts[0];

  return (
    <div className="rounded-xl border border-gray-700 bg-black/40 p-4 space-y-3 text-xs text-gray-300 leading-relaxed">
      <div className="text-sm font-black uppercase tracking-widest text-white">Napojiť Zoho Mail</div>
      <ol className="list-decimal pl-4 space-y-2">
        <li>
          Otvor <b className="text-white">api-console.zoho.eu</b> → Add Client → <b className="text-white">Self Client</b> → Create.
          Client ID a Client Secret daj na Railway (BE → Variables) ako <code className="text-lime-200">ZOHO_CLIENT_ID</code> a{" "}
          <code className="text-lime-200">ZOHO_CLIENT_SECRET</code> a počkaj na reštart.
        </li>
        <li>
          V Self Client → <b className="text-white">Generate Code</b>: Scope (nižšie), Time 10 minutes, popis „SelfRace“ →
          Create → vyber účet support@selfrace.com a skopíruj kód.
          <div className="mt-2">
            <CopyRow label="Scope" value={SCOPE} />
          </div>
        </li>
        <li>Kód hneď vlož sem (platí len pár minút):</li>
      </ol>

      <div className="flex flex-wrap gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="1000.xxxxxxxx…"
          className="flex-1 min-w-[200px] bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-lime-500"
        />
        <button
          onClick={connect}
          disabled={busy || !code.trim()}
          className="bg-lime-400 text-black text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg disabled:opacity-40"
        >
          {busy ? "Overujem…" : "Získať token"}
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300">{error}</div>}

      {result && (
        <div className="space-y-3 pt-2 border-t border-gray-800">
          <p className="text-emerald-300">
            Hotovo ✓ Tieto dve hodnoty pridaj na Railway (BE → Variables). Po reštarte pôjdu maily cez Zoho Mail. Token tu
            vidíš len teraz – nikam sa neuložil.
          </p>
          <CopyRow label="ZOHO_REFRESH_TOKEN" value={result.refresh_token} />
          {account && <CopyRow label="ZOHO_ACCOUNT_ID" value={account.account_id} />}
          {account && !account.addresses.includes(result.sender) && (
            <p className="text-yellow-300">
              Pozor: adresa {result.sender} nie je v tomto účte medzi adresami na odosielanie ({account.addresses.join(", ")}). V
              Zohu ju pridaj ako alias (Settings → Send Mail As), inak Zoho mail odmietne.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
