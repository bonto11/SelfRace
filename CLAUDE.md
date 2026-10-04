# SelfRace

AI tréner pre vytrvalostných športovcov (beh, trail, OCR). PWA pre slovenský a český trh, vyvíja ho jeden človek. Dáta zo Stravy, plány a hodnotenia generuje AI.

Komunikuj po slovensky, stručne a priamo. Bez zbytočného vysvetľovania.

## Repozitár

FE aj BE sú v jednom repe.

**Backend** (`Backend/`) – Python, FastAPI, Supabase (Postgres + RLS). Vstup je `main.py` (`uvicorn main:app`), `app.py` je prázdny. `README.md` a `notes.txt` v `Backend/` sú zastarané (Trainalyze) – neriaď sa nimi.
- `Configs/` – konštanty a katalógy (cviky, svalové partie, objemy, náročnosť aktivít), `config.py` = env premenné
- `DB/` – prístup k tabuľkám, nič iné. Každá funkcia berie `ctx: AuthCtx` a používa `get_sb(ctx, caller="modul.funkcia")`
- `Services/` – logika. `Services/AI/` = jednotlivé AI moduly
- `Routes/` – FastAPI endpointy
- `Schemas/` – Pydantic modely
- `Modules/` – infraštruktúra: `Supabase/` (auth, klient), `Strava/` (API, webhook), `Stripe/` (billing, webhook)
- `Workers/async_jobs.py` – worker pre frontu `async_jobs`
- `Services/AI/provider/` – Claude / Gemini / OpenAI s fallbackom (`AI_PROVIDER` v env). AI volaj len cez `provider.py`, nie priamo klienta.
- Model pre AI úlohu: `AI_MODEL_<ÚLOHA>` v env (`ai_model_for()` v `Configs/config.py`, zoznam `AI_TASKS`). Nenastavené = `CLAUDE_DEFAULT_MODEL`; pri zlyhaní ide reťaz ďalej na default a fallbacky. Novšie Claude modely (Sonnet/Opus 5.x) nedostávajú `temperature`, ale `effort` (`CLAUDE_EFFORT`) a rezervu `max_tokens` na thinking – viď `_request_params` v `claude_client.py`. Nová AI úloha = nový kľúč v `AI_TASKS`.
- Cron: Vercel → `frontend/src/app/api/cron/trigger/route.ts` → BE `Routes/trigger.py` → `Services/trigger_tasks.py` (zoznam taskov)

**Frontend** (`frontend/`) – Next.js 16 (Turbopack), React 19, Tailwind, zustand, SWR, deploy na Vercel.
- `src/app/features/<oblasť>/` – `api/`, `components/`, `constants/`, `utils/`
- `src/app/shared/` – spoločné komponenty (`components/session/`, `ui/components/`), hooky, i18n, UI tokeny
- `src/app/(protected)/` – stránky za prihlásením, `src/app/(auth)/` – prihlásenie, registrácia, verejné stránky
- `shared/config.ts` – `API_URL` a ďalšie env hodnoty

Ak sa cesty v repe líšia od tohto popisu, oprav túto sekciu.

## Spustenie

- FE: `cd frontend && npm ci && npm run dev`
- BE: `cd Backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`
- Supabase migrácie: skripty `sb:*` v koreňovom `package.json` (dev a prod projekt)
- Testy v repe nie sú (`Backend/test_models.py` je len výpis Gemini modelov).

## Pred dokončením úlohy (POVINNÉ)

- FE: `cd frontend && npx tsc --noEmit` (bez `node_modules` najprv `npm ci`). Build na Verceli padá na typoch, ktoré lokálne nikto nevidel – nikdy neodovzdávaj zmenu FE bez tohto kroku.
- BE: aspoň `python -m py_compile` na zmenené súbory.
- Ak meníš API (route, payload, odpoveď), uprav BE aj FE v tej istej zmene – Pydantic model v route, service, TS typy v `features/*/api/*.ts`.

## Konvencie

**BE**
- `ctx: AuthCtx` je vždy keyword-only a ide cez všetky vrstvy.
- Service vracia dict s `ok`/`code` (alebo `success`/`error_code` na úrovni route). FE prekladá `error_code` cez i18n (napr. `advisorDaily.errors.<code>`) – nový kód = nový i18n kľúč.
- Každé AI volanie: kontrola kvóty (`is_user_over_token_quota`) pred volaním a zápis spotreby (`log_ai_usage_for_user`) po ňom – viď `Services/AI/utils/billing.py`.
- **User platí len za výstup, ktorý reálne dostane.** Poradie: AI → kontrola obsahu (`ai_output_has_text` na hlavný text) → uloženie → až potom billing. Prázdny/neplatný výstup = `ai_generation_failed`, nič sa neukladá ani nemaže, neúčtuje sa. Pri pláne sa starý plán maže až keď sú pripravené nové riadky; zmazané riadky sú záloha a pri zlyhaní insertu sa vrátia (`db_restore_daily_rows` / `db_restore_weekly_rows`, kód `plan_save_failed`) – Supabase REST nemá transakciu.
- Zlyhanie vedľajšej veci (billing, AI kontextový blok, notifikácia) nesmie zhodiť hlavnú operáciu – `try/except`, log, pokračuj.
- **Poradie routes:** statické cesty pred parametrickými (`/{user_id}/muscle-volume` musí byť PRED `/{user_id}/{session_id}`, inak 422).

**FE**
- Volania BE cez `callBackend` z `shared/utils/callBackend`.
- Farby a štýly z `shared/ui/tokens` a `appColors`, nie natvrdo.
- Modaly sú portály s `zIndex: 2147483000`, menu nad nimi `2147483600`.
- **iOS klávesnica:** nezmenšuje `100vh`/`100dvh`, len prekryje spodok. Modaly a menu s textovým vstupom sa musia držať `window.visualViewport` (hook `shared/hooks/useVisualViewport`). Na telefóne sa `ExercisePicker` otvára ako panel cez obrazovku.
- `AppHeader` je `position: fixed` – jeho šírku a pozíciu určuje `PageShell` meraním priestoru stránky (na PC je vľavo bočná navigácia).

**i18n**
- FE má zatiaľ len SK a EN (`shared/i18n/locales/sk.ts`, `en.ts`, preklad cez `useT`). Každý nový text do oboch, žiadny chýbajúci kľúč.
- CS existuje len v AI promptoch na BE. Kým sa nepridá `cs.ts`, CS do FE nepridávaj.
- Bez natvrdo písaných textov v komponentoch.

**Komentáre**
- Po slovensky. Pri netriviálnom rozhodnutí napíš PREČO, nie čo (napr. prečo sa externé aktivity zlučujú pri čítaní a nezapisujú do DB).

## Architektúra AI

Každý modul má `builders.py` (kontext z DB), `prompts.py`, `generate.py`, `main.py`.

| Modul | Otázka | Kedy beží |
|---|---|---|
| `athlete_state` | Aký je to športovec – trénovanosť, únava, riziko, tempá, odhady časov | Nedeľa 23:00 + ručne. Rovnaké pre coach aj advisor |
| `advisor_review` | Je plán týždňa dobre poskladaný | Len advisor. Nedeľa 23:00 + tlačidlo „Skontroluj mi týždeň“ |
| `activity_review` | Hodnotenie jednej aktivity | Na požiadanie. Silový tréning len na vyžiadanie |
| `daily_plan`, `weekly_plan` | Generovanie plánu | Len coach režim |
| `session_preview` | Náhľad / úprava jednej naplánovanej session | Na požiadanie |
| `body_scan` | Vyhodnotenie body scanu | Na požiadanie |
| `monthly_review`, `plan_completion` | Mesačné zhrnutie, zhodnotenie dokončeného plánu | Cron (`monthly-summary`, `coach-plan-complete`) |

Moduly bez `builders.py`/`prompts.py` (`monthly_review`, `plan_completion`, čiastočne `body_scan`) majú všetko v `generate.py`.

- **athlete_state a advisor_review sú zámerne oddelené.** Advisor si trénovanosť nepočíta, len prečíta posledný uložený athlete state. Nespájaj ich.
- **Nedeľné joby** bežia len pre userov s aktivitou alebo silovým tréningom za posledných 14 dní (`Services/AI/utils/activity_gate.py`). Ručné spustenie bránu nemá.
- Cache: `STATE_FRESH_HOURS = 12`, `REVIEW_FRESH_HOURS = 6`. `force=True` cache prebije.

### Coach vs advisor režim

- **Coach:** plán skladá AI a sama ho upravuje (autoadjust).
- **Advisor:** plán si skladá user ručne (`ManualSessionForm`). AI len radí a hodnotí – nikdy nič negeneruje ani nemení.
- Prepnutie coach → advisor kedykoľvek (s potvrdením). Advisor → coach je blokované, kým beží plán (`_guard_coach_mode_switch` v `Services/user_prefs.py` + UI). Zmena režimu sa ukladá hneď, nie cez tlačidlo Uložiť.
- Každý generátor plánu musí mať advisor gate na začiatku.

### Iné aktivity a udalosti

- `sport="other"` v dennom pláne NIE JE tréning – je to udalosť (svadba, teambuilding, sťahovanie, futbal mimo plánu). Štruktúra `{"event": {kind, load, counts_as_training}}` – viď `Configs/activity_load.py`.
- Náročnosť: `easy` / `moderate` / `hard`. Udalosť s `counts_as_training=false` sa NERÁTA do tréningového objemu.
- Opakujúce sa externé aktivity z prefs sa do plánu **zlučujú pri čítaní** (`service_get_daily_overview`, advisor builder), nezapisujú sa do `coach_plan_daily`. Majú záporné `id` a `is_external: true` – na FE sa nedajú upraviť ani zmazať.

### Recovery

- Stĺpce: `HRV_avg_ms`, `RHR_bpm`, `sleep_duration_min`, `alcohol_consumed`, `caffeine_8h`, `food_2h_before`, `comments`.
- `db_get_recent_recovery` vracia riadky **od najnovšieho**.
- AI dostáva baseline, denný priebeh za týždeň, faktory aj poznámku – prepad HRV s príčinou (alkohol) ≠ prepad bez príčiny.

### Silový tréning

- Objem sa ráta po **svalových partiách**, nie po pohybových vzoroch. Cvik sa ráta celý pre hlavné partie a polovične pre pomocné.
- `Configs/strength_muscles.py` ↔ `features/strength/constants/strengthMuscles.ts` – FE je zrkadlo BE, **musia byť v súlade**. To isté katalóg cvikov.

## Pravidlá pre AI prompty

Platia pre všetky moduly, väčšina už existuje ako funkcie `_..._rule()` v `prompts.py`:

- Text v jazyku usera (SK/EN/CS), 2. osoba, správny rod podľa pohlavia.
- **Žiadne surové hodnoty v texte:** `true/false`, názvy polí, enumy (`external_event`, `training`), relatívne dni (`today-3` → „pred 3 dňami“).
- Časy ako `M:SS` / `H:MM:SS`, tempo `mm:ss/km`, objem v minútach ako `9 h 33 min`.
- Svalové partie po slovensky (prsia, chrbát, ramená, predné stehná…). Pozor na známu chybu: „nohy“ ≠ „nohavice“.
- Čísla v texte len z kontextu a rovnaké v celej odpovedi.
- Zdravie: rozlišuj aktuálny problém od minulého. `needs_caution` len pri aktuálnom – spúšťa autoadjust.
- Advisor režim: AI nikdy nesľubuje, že plán upraví.
- Terén: pomalý kilometer do kopca nie je únava ani „mentálna odolnosť“.

## Známe otvorené veci

- `DetailPlan` – pri cvikoch na čas sa `reps` („30-45“) zobrazuje bez jednotky.
- FE nemá CS preklad (`cs.ts`), hoci produkt cieli aj na CZ trh.
- `npm run dev:all` je len pre Windows (`.venv\Scripts`) a odkazuje na `../backend` malým písmenom.

## Čo nerobiť

- Nerefaktoruj nesúvisiaci kód popri úlohe.
- Nezapisuj externé aktivity do `coach_plan_daily`.
- Nemeň schému DB bez SQL migrácie v odpovedi (vrátane RLS podľa vzoru existujúcich tabuliek).
- Necommituj tajomstvá ani `.env`.
