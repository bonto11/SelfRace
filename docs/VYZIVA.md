# Výživa v SelfRace

Popis sekcie Výživa: čo robí, ako počíta a kde je v kóde. Funkcia je za prepínačom `nutrition` (admin panel → Funkcie). Najprv ju vidí admin, potom beta skupina, nakoniec všetci.

---

## 1. Prečo a pre koho

**Komu je určená:** amatérskemu bežcovi, trailistovi, OCR či hybridnému športovcovi v SK/CZ. Chce lepší výkon alebo popri tréningu schudnúť. Každý deň sa hýbe inak: voľno, ľahký beh, intervaly, dlhý beh, pretek.

**Čo im kalorické tabuľky nedajú:** tabuľky nevedia nič o tréningu. Pevný cieľ znamená, že v náročný deň je človek podjedený a vo voľný prejedený. Športové appky (Hexis, Fuelin) sú po anglicky, drahé, robené pre profíkov a nemajú náš plán ani slovenské a české jedlá.

**Naše pravidlá (platia pre kód, texty aj AI):**

1. **Nesľubujeme, že za nikoho schudneme.** Ukážeme koľko a čo jesť podľa tréningu a dáme nástroje. Rozhoduje user.
2. **Úprimnosť.** Každé číslo je odhad. Vzorce aj hodinky sa mýlia o 10–15 % a appka to hovorí nahlas („Ako sa to počíta“, kalibrácia, návrhy). Presnejšie čísla dávame až z reálnych dát (váha + celé dni).
3. **Bez zahanbovania.** Žiadne červené „prekročil si“. Zjesť viac ako cieľ je neutrálny stav, nie chyba. Rozdiel sa rozloží do zvyšku týždňa. Varovania sú žlté a znejú ako rada.
4. **Výkon a zdravie majú prednosť pred chudnutím.** Pred pretekom a v deň pretekov deficit nie je, v náročný deň je polovičný. Pri dlhodobom podjedení appka varuje (RED-S) a radí jesť viac, nikdy menej.
5. **Hodnota aj bez zapisovania.** Palivo na dnes a ďalšie dni a tanier v režime bez počítania fungujú, aj keď user nezapíše nič.
6. **Ciele počíta kód, nie AI.** AI odhaduje len zloženie jedla, navrhuje jedlá a v hodnotení výživu komentuje. Čísla cieľov nemení.

---

## 2. Čo user dostane

### Nastavenie (`NutritionProfileSetup`)
- **O tebe:** pohlavie, dátum narodenia, výška, váha. Sú to rovnaké údaje ako v Bio a na Výkone (`profile_static`, `users_metrics`), takže sa nič neduplikuje.
- **Cieľ:** chudnúť / udržiavať / naberať a tempo (chudnutie 10–20 %, naberanie 5–10 %). Do 18 rokov a pri BMI pod 18,5 je možné len udržiavanie.
- **Režim:**
  - **S číslami** – kalórie a makrá, zápis jedla, týždeň, kalibrácia.
  - **Bez počítania** – tanier a porcie rukou, žiadne kalórie. Je pre ľudí, ktorých čísla stresujú, a slúži aj ako poistka pri sklone k poruchám príjmu potravy.
- **Rozšírené:** pohyb mimo tréningov (NEAT) a bielkoviny (automaticky podľa cieľa alebo 1,6–2,2 g/kg). Bazálny metabolizmus je ručný, inak ide z body scanu (InBody), inak zo vzorca.
- **Súhlas** so spracovaním údajov o strave. Bez neho sa profil neuloží. Vypnutie zmaže všetky údaje o strave.

### Denný prehľad (`/nutrition`, `NutritionDayView`)
- **Cieľ dňa:** zjedené / cieľ kcal a pruhy bielkovín, sacharidov a tukov. V režime bez počítania sa namiesto toho ukáže **tanier dňa** (pomer prílohy, bielkovín a zeleniny podľa záťaže) a porcie rukou.
- **Ako sa to počíta:** rozpis BMR, NEAT, tréningov, kalibrácie, pretekov, rozpočtu a makier a pripomienka, že ide o odhad.
- **Palivo na najbližšie dni** (`FuelCard`): dnes, zajtra a pozajtra. Ukáže záťaž dňa, tréningy, pretek a konkrétne rady (pozri 3.4).
- **Tréningy dňa,** z ktorých je cieľ: aktivity zo Stravy, ručná sila, plán, externé aktivity, pretek.
- **Jedlá podľa časti dňa.** Pri prázdnom jedle je tlačidlo **„Zopakovať (včera…)“**.
- **„Deň mám zapísaný celý“** – zaškrtávatko. Celé dni sa berú do rozpočtu, kalibrácie a varovaní.
- **Čo zjesť na zvyšok dňa** – AI návrh (pozri 3.6).
- **Varovania** z posledných 7 dní (pozri 3.7).
- **Posledných 7 dní** (graf a priemery), **kalibrácia výdaja** a **váha**.

### Zápis jedla (`AddFoodModal`)
Text („2 rožky s maslom“), fotka taniera, čiarový kód (Open Food Facts + vlastná databáza), fotka etikety, obľúbené, nedávne, ručne, „Zopakovať“ a „+ Pridať“ z AI návrhu. AI návrh je vždy len návrh: user ho upraví a potvrdí. Zmena gramov prepočíta makrá.

### Widget „Výživa dnes“ (Domov a sekcia Výživa)
Zjedené / cieľ a makrá, v režime bez počítania tanier. Tichý riadok upozorní na zajtrajšok: náročný deň, doplnenie sacharidov alebo pretek („dnes večer pridaj prílohu“).

### Živý tréner
Tréner výživu zverenca **len číta**: deň, palivo, týždeň, kalibráciu, „celý deň“ (RLS `trainer_read`). Nič nezapíše, nespustí AI a neresetuje kalibráciu. Bez profilu zverenca vidí len informáciu, že ho zverenec nemá. Súhlas dáva výhradne zverenec.

---

## 3. Ako sa to počíta

Všetko je v `Backend/Services/nutrition_targets.py` a konštanty sú v `Backend/Configs/nutrition.py`. Ciele sa **počítajú pri čítaní a neukladajú sa**. Aktivita zo Stravy príde aj o hodiny neskôr a plán sa mení, takže uložený cieľ by rýchlo zastaral.

### 3.1 Výdaj
```
výdaj = (BMR × NEAT + 0,75 × kcal tréningov dňa) × kalibračný faktor
```
- **BMR:** ručný > z body scanu (`users_metrics.bmr_kcal`, najviac 180 dní starý) > Mifflin-St Jeor.
- **NEAT** (pohyb mimo tréningov): 1,2–1,5, predvolene 1,3.
- **Tréningy dňa:**
  - minulé dni = aktivity (kcal zo Stravy, inak MET) a ručné silové zápisy bez Stravy,
  - dnes = aktivity a ešte neodcvičený plán,
  - budúce dni = plán, externé aktivity a pretek z cieľov.
- **0,75 z kcal tréningu:** hodinky nadhodnocujú a časť výdaja už pokrýva BMR × NEAT.
- **Udalosti** (svadba, sťahovanie): počítajú sa čistým MET nad bežný deň a záťaž dňa cez kcal nezvyšujú.
- **Kalibračný faktor:** 0,90–1,15, bez kalibrácie 1 (pozri 3.5).

### 3.2 Záťaž dňa → sacharidy
| Záťaž | Kedy | Sacharidy g/kg |
|---|---|---|
| `rest` | bez tréningu | 3 |
| `easy` | ľahký / regeneračný | 4 |
| `moderate` | ≥ 5 kcal/kg z tréningu | 5,5 |
| `hard` | intervaly, tempo, dlhý (beh ≥ 90 min, iné ≥ 120 min), ≥ 12 kcal/kg | 7,5 |
| `load` | doplnenie sacharidov pred dlhým pretekom | 8 |
| `race` | deň dlhého pretekov | 7,5 |

- g/kg sa rátajú z „referenčnej“ váhy, najviac pri BMI 27. Pri 130 kg by inak vyšlo 900 g sacharidov.
- **Bielkoviny:** automaticky chudnutie 2,0 / udržiavanie 1,6 / naberanie 1,8 g/kg alebo vlastná voľba. V palivové dni (`load`, `race`) najviac 1,6 g/kg.
- **Tuky** sú zvyšok, ale najmenej 0,8 g/kg. Keď na tuky nezostane, uberú sa sacharidy. Pred pretekom a v deň pretekov sa sacharidy neuberajú, vyššie pôjdu kcal.

### 3.3 Cieľ podľa cieľa usera
- **Chudnutie:** výdaj − 10–20 %, najviac 0,75 % váhy za týždeň (7700 kcal ≈ 1 kg).
  - V **náročný deň** je deficit polovičný (`hard_day_deficit`). Podjedený tvrdý tréning je horší tréning a vyššie riziko zranenia, preto je chudnutie o kúsok pomalšie.
  - V **deň doplnenia a pretekov** nie je deficit žiadny (`race_fueling`).
- **Naberanie:** výdaj + 5–10 %.
- **Poistky:** kcal ≥ BMR, do 18 rokov a pri BMI < 18,5 len udržiavanie. Ktorá poistka zabrala, je v `breakdown.limits` a FE to povie.

### 3.4 Preteky a palivo (`Services/nutrition_fuel.py`, `GET /nutrition/{id}/fuel`)
- **Preteky** sa berú z coach prefs (`targets.run.races`): dátum, názov, dĺžka (`race_goal` / `custom_distance_km`), cieľový čas a typ + prevýšenie.
  - Bez cieľového času sa čas odhadne z tempa podľa typu (cesta 6:00/km, trail 8:00/km, OCR 9:00/km…) a 6 min na 100 m prevýšenia. FE vtedy povie, že je to odhad.
- **Doplnenie sacharidov:**
  - pretek ≥ 90 min → 1 deň vopred,
  - pretek ≥ 150 min (maratón, ultra) → 2 dni vopred,
  - kratší pretek → len deň pretekov ako náročný deň.
- **Rady na deň** (čísla z referenčnej váhy, zaokrúhlené na 5 g):

| Situácia | Rada |
|---|---|
| deň voľna / ľahký | bežné jedlo, sacharidy dňa |
| tréning ≥ 60 min alebo náročný | **pred:** 1 g/kg sacharidov 1–3 h vopred, málo tuku a vlákniny |
| tréning ≥ 75 min | **počas:** 45 g/h (do 2,5 h), 75 g/h (dlhšie), ~500 ml tekutín/h |
| náročný alebo ≥ 90 min | **po:** 0,3 g/kg bielkovín + 1 g/kg sacharidov do 1–2 h |
| zajtra náročný deň / pretek | **večer pred:** +1 g/kg sacharidov (príloha) |
| deň doplnenia | sacharidy dňa (8 g/kg), menej vlákniny a tuku, váha +1–2 kg = voda a glykogén |
| deň pretekov | raňajky 2 g/kg 2–3 h pred štartom, počas g/h podľa dĺžky (krátky pretek = len voda), po cieli bielkoviny a sacharidy |

- Režim bez počítania má rovnaké rady **bez gramov** („o päsť prílohy viac“, „gél každých 20–30 min“).
- Zdroj: odporúčania športovej výživy (ISSN, ACSM), zaokrúhlené pre amatérov. Rady neradia nič nové na pretekoch – „skúšaj na tréningu“.

### 3.5 Kalibrácia výdaja (`Services/nutrition_calibration.py`)
Vzorec sa mýli o ±15–25 %. Človek drží cieľ, váha sa nehýbe a appke prestane veriť. Kalibrácia preto počíta skutočný výdaj z reálnych dát:
```
skutočný výdaj = priemerný príjem − sklon váhy (kg/deň) × 7700
faktor = skutočný výdaj / výdaj podľa modelu (za tie isté dni)
```
- **Okno:** 28 dní do včera.
- **Podmienky:**
  - aspoň 14 dní označených „Deň mám zapísaný celý“,
  - aspoň 4 váženia v rozpätí ≥ 14 dní,
  - sklon váhy z lineárnej regresie.
- **Poistky:**
  - faktor najviac 0,90–1,15. Nadol menej, lebo kto zabudne zapísať jedlo, vyjde mu nízky výdaj a appka by mu radila jesť ešte menej.
  - zmena najviac o polovicu rozdielu naraz, aby voda alebo cyklus faktor nerozhodili.
- **Prepočet** beží pri čítaní dňa, keď je starší ako 3 dni a pýta sa sám user (tréner nie). Uloží sa do `nutrition_profile` (`tdee_factor`, `tdee_calibration`, `tdee_calibrated_at`).
- **Kým nie je dosť dát,** karta ukáže, čo chýba („celé dni 7 z 14, váženia 2 z 4“) a doterajší faktor ostáva. User môže kalibráciu začať odznova.

### 3.6 Týždenný rozpočet a „zlý deň“
- **Týždeň** = po–ne. Pre dnešok a ďalšie dni aktuálneho týždňa sa rozdiel minulých dní rozloží do zvyšku týždňa.
- **Minulý deň sa ráta podľa zjedeného:**
  - keď je označený ako celý,
  - alebo keď zjedol viac ako cieľ (to je dolná hranica aj pri neúplnom zápise).
  - Neúplný deň pod cieľom sa berie ako splnený. Inak by zabudnutý obed znamenal „zjedz večer o 800 kcal viac“.
- **Úprava:**
  - najviac ±15 % cieľa dňa, nikdy pod BMR, rozdiel týždňa do 100 kcal sa nerieši,
  - náročné a pretekové dni sa neuberajú, ubrať sa dá len z ľahších dní,
  - bielkoviny ostávajú, tuky neklesnú pod minimum, uberajú sa sacharidy.
- **FE** to povie neutrálne: „Tento týždeň je zatiaľ nad plánom – dnes o 120 kcal menej. Nič sa nedeje, rozloží sa to do ďalších dní.“ Prekročenie dňa má sivý štítok, nie červený.

### 3.7 Varovania (`_warnings` v `Services/nutrition.py`)
Počítajú sa z posledných 7 dní, len z **celých dní** (označený alebo aspoň 3 rôzne jedlá dňa), bez dneška:
- **Podjedenie (RED-S):** aspoň 4 celé dni a priemer < 75 % cieľa.
- **Málo sacharidov v náročné dni:** náročný, doplňovací alebo pretekový deň s < 60 % cieľa sacharidov.
- **Rýchly pokles váhy:** trend za 21 dní (≥ 3 váženia, ≥ 10 dní) rýchlejší ako 1 % váhy za týždeň (počíta sa aj bez zapisovania jedla).

Karta je žltá, ponúkne radu (jesť viac okolo tréningov, spomaliť) a odkaz na lekára alebo nutričného terapeuta. Rovnaké varovania idú do AI (pozri 4).

### 3.8 AI návrh jedál na zvyšok dňa (`POST /nutrition/{id}/suggest`)
- **Kedy:** len pre dnešok alebo zajtrajšok a len keď ostáva aspoň 150 kcal.
- **Ktoré jedlá navrhne:** jedlá dňa, ktoré ešte nie sú zapísané. Dnes podľa hodiny: raňajky do 11:00, obed do 16:00, večera do 22:00. Snack pridá, keď je pred tréningom alebo nič iné neostáva.
- **Vstup pre AI:** zvyšok makier, tréningy dňa (hotové / pred nami), záťaž dňa, cieľ a **kandidáti**, teda obľúbené a nedávne jedlá usera s id `f1…`, `r1…`.
- **Výstup AI:**
  - pri vlastnom jedle `{ref, portion}`,
  - pri novom jedle `{name, grams, hodnoty na 100 g}`.
- **Čísla počíta BE:**
  - makrá z uložených hodnôt alebo zo 100 g,
  - potom všetky gramy dorovná na zvyšok dňa (pomer 0,6–1,6, gramy na 5 g). AI v počítaní chybuje.
- **Uloženie a cena:** návrh sa uloží do `nutrition_days.suggestion` (raz za deň). „Nový návrh“ je ďalšie AI volanie a účtuje sa. Prázdny alebo neplatný návrh sa neukladá ani neúčtuje.
- **„+ Pridať“** zapíše jedlo so `source = "suggestion"`, ďalej sa dá upraviť ako každý zápis.
- **Nie je to jedálniček.** Týždenný jedálniček takmer nikto nedodrží, preto je to vždy len „čo teraz“.

### 3.9 „Ako včera“ a celý deň
- `repeat_options` v odpovedi dňa: pre každé jedlo bez zápisu posledný deň z posledných 3, keď ho mal (počet, kcal, názvy). `POST /log/copy` skopíruje zápisy (`source = "copy"`).
- `PUT /day/{day}/complete` zapíše `nutrition_days.complete`.

---

## 4. AI – čo robí a čo nie

| Kde | Úloha (`AI_TASKS`) | Čo robí | Účtuje sa |
|---|---|---|---|
| Zápis textom | `nutrition_text` | rozdelí text na položky, odhadne porcie a hodnoty | platný neprázdny návrh |
| Fotka taniera | `nutrition_photo` | to isté z fotky | to isté |
| Fotka etikety | `nutrition_label` | **len prepíše** tabuľku; kJ→kcal a porcia→100 g počíta BE | čitateľná etiketa |
| Návrh jedál | `nutrition_suggest` | vyberie jedlá a pomer; gramy a makrá dopočíta BE | platný návrh |
| Hodnotenie týždňa (advisor) | `advisor_review` | výživu len **komentuje** (blok `nutrition` + `warnings`) | v rámci hodnotenia |
| Stav športovca | `athlete_state` | výživu berie ako kontext únavy a regenerácie | v rámci analýzy |

Pravidlá v promptoch (`_nutrition_rule`):
- AI **nikdy** nenastavuje ani nenavrhuje nové ciele kcal a makier a nedáva diétu ani jedálniček.
- Pri `underfuel` / `low_carb_hard_days` povie pokojne, že ide o nízku dostupnosť energie: stojí výkon a regeneráciu a dlhodobo zvyšuje riziko RED-S. Radí jesť viac okolo tréningov, nikdy menej.
- Pri `fast_loss` radí spomaliť.
- Nediagnostikuje, nezahanbuje, nesľubuje chudnutie ani výsledok. Keď varovania nie sú, nevymýšľa ich.
- Pri menej ako 5 zapísaných dňoch je to len čiastočný obraz a AI to povie.

Kvóta sa kontroluje pred každým AI volaním. Spotreba sa zapisuje až po platnom výstupe (`Services/AI/utils/billing.py`). Fotky sa na serveri neukladajú.

---

## 5. Bezpečnosť a súkromie

- **Poistky v kóde:**
  - kcal ≥ BMR,
  - chudnutie najviac 0,75 % váhy/týždeň,
  - < 18 rokov a BMI < 18,5 len udržiavanie,
  - v náročný deň polovičný deficit, pred pretekom žiadny,
  - rozpočet najviac ±15 % a nikdy pod BMR,
  - kalibrácia v úzkom pásme.
- **Režim bez počítania** pre ľudí, ktorým čísla nerobia dobre.
- **Súhlas:** bez súhlasu sa nič neuloží. Odvolanie (`DELETE /nutrition/{id}/profile`) zmaže profil, zápisy, obľúbené, stav dní aj vlastné produkty. Váha a Bio ostanú.
- **RLS:** každý vidí len svoje riadky, tréner len číta (`trainer_read` cez `sr_my_athlete_ids()`). Zápis a AI má len vlastník (`_guard(own=True)` overí `caller == user_id`, aby AI nemíňala kvótu cudzieho usera).
- **Open Food Facts:** výsledky sa ukladajú pre všetkých (`source = 'off'`), vlastné produkty z etikety vidí len autor.

---

## 6. Technika

### Tabuľky (Supabase)
| Tabuľka | Čo | Migrácia |
|---|---|---|
| `nutrition_profile` | cieľ, tempo, BMR, NEAT, bielkoviny, `mode`, `tdee_factor`, `tdee_calibration`, `tdee_calibrated_at`, `consent_at` | `nutrition.sql`, `nutrition_bmr_protein.sql`, `nutrition_phase4.sql` |
| `food_log` | zápis jedla (deň, jedlo dňa, položka, makrá, `source`, `product_id`) | `nutrition.sql`, `nutrition_phase4.sql` (zdroje `suggestion`, `copy`) |
| `food_favorites` | obľúbené jedlo = viac položiek | `nutrition.sql` |
| `food_products` | produkty z čiarového kódu / etikety (na 100 g) | `nutrition_phase2.sql` |
| `nutrition_days` | stav dňa: `complete`, `suggestion` | `nutrition_phase4.sql` |

Ďalej sa číta z: `profile_static` (pohlavie, narodenie, výška), `users_metrics` (`weight_kg`, `bmr_kcal`), `activities_summary`, `strength_sessions`, `coach_plan_daily`, `coach_external_events`, `users_preferences` `coach.prefs` (preteky).

### Endpointy (`Backend/Routes/nutrition.py`, všetko za prepínačom `nutrition`)
| Metóda a cesta | Čo | Kto |
|---|---|---|
| `GET/PUT/DELETE /nutrition/{id}/profile` | profil, súhlas, režim, reset kalibrácie / zmazanie údajov | GET aj tréner, zápis vlastník |
| `GET /nutrition/{id}/day/{day}` | deň: ciele, rozpis, zápisy, rozpočet, kalibrácia, ako včera, návrh | aj tréner |
| `PUT /nutrition/{id}/day/{day}/complete` | „deň mám zapísaný celý“ | vlastník |
| `GET /nutrition/{id}/fuel` | palivo na dnes + 2 dni | aj tréner |
| `GET /nutrition/{id}/week` | 7 dní, priemery, varovania | aj tréner |
| `POST /nutrition/{id}/log`, `PATCH/DELETE /log/{entry}` | zápis jedla | vlastník |
| `POST /nutrition/{id}/log/copy` | „Ako včera“ | vlastník |
| `GET /nutrition/{id}/recent`, `GET/POST/DELETE /favorites` | nedávne, obľúbené | čítanie aj tréner |
| `POST /nutrition/{id}/parse-text` / `parse-photo` / `parse-label` | AI návrh položiek / produktu | vlastník |
| `POST /nutrition/{id}/suggest` | AI návrh jedál na zvyšok dňa | vlastník |
| `GET /nutrition/{id}/barcode/{code}`, `POST /products` | čiarový kód, vlastný produkt | vlastník |

### Súbory
- **BE:**
  - `Configs/nutrition.py` (všetky čísla),
  - `Services/nutrition.py` (profil, deň, rozpočet, zápisy, týždeň, varovania, sumár pre AI),
  - `Services/nutrition_targets.py` (ciele, tréningy dňa, preteky),
  - `Services/nutrition_fuel.py`,
  - `Services/nutrition_calibration.py`,
  - `Services/nutrition_products.py` + `Modules/OpenFoodFacts/client.py`,
  - `Services/AI/nutrition/` (prompty, generovanie, návrh jedál),
  - `DB/nutrition.py`.
- **FE** `frontend/src/app/features/nutrition/`:
  - `components/`: `NutritionDayView`, `NutritionProfileSetup`, `AddFoodModal`, `FuelCard`, `PlateGuide`, `MealSuggestions`, `CalibrationCard`, `NutritionWarnings`, `NutritionWeekCard`, `NutritionWeightCard`, skener, etiketa…
  - `widgets/WidgetNutritionToday.tsx`,
  - `utils/fuel.ts` (texty rád, tanier),
  - `hooks/useNutritionWeek.ts`.
- **Dáta na FE:** `shared/components/dataProviders/NutritionDataProvider.tsx` (dnešok + palivo). Stránka je `(protected)/nutrition/page.tsx`.
- **Texty:** i18n `nutrition.*` v SK/CS/EN (`fuel`, `plate`, `budget`, `complete`, `repeat`, `suggest`, `calibration`, `warnings`…).

### Migrácie (spúšťa sa ručne v Supabase, v tomto poradí)
1. `Backend/sql/nutrition.sql`
2. `Backend/sql/nutrition_phase2.sql`
3. `Backend/sql/nutrition_bmr_protein.sql`
4. `Backend/sql/nutrition_phase4.sql`
5. (prípadne znova) `Backend/sql/trainer_read_access.sql` – obsahuje aj `nutrition_days`

Bez migrácie fázy 4 BE nespadne: stav dní je prázdny a kalibrácia sa neuloží. Zápis „Ako včera“ a „+ Pridať“ z návrhu však neprejde cez kontrolu `source`.

---

## 7. Čo zatiaľ nie je (úprimne)

- **Čas tréningu počas dňa:** plán čas nemá, preto rady „pred“ sú „1–3 h vopred“, nie „o 7:00“.
- **Hlasový zápis.**
- **Slovenská/česká databáza bežných jedál:** spoliehame sa na AI odhad, Open Food Facts a vlastné produkty.
- **Menštruačný cyklus vo výpočte:** je len v health logu pre AI, cieľ neupravuje.
- **Prepojenie s plánom v coach režime:** generátor plánu výživu nečíta. Varovania idú do athlete state a advisor hodnotenia, ktoré tréning ovplyvňujú nepriamo.
- **Notifikácie** („zajtra dlhý beh – dnes večer príloha“): zatiaľ len tichý riadok vo widgete.

## 8. Ako zistíme, či to funguje (beta 4–6 týždňov)

- Koľko ľudí zapisuje aspoň 3 dni v týždni a koľko označuje celé dni.
- Koľkým sa podarí kalibrácia (stav `ok`) a ako ďaleko je faktor od 1.
- Pri cieli „chudnúť“: či sa váha hýbe tempom, ktoré si zvolili, a nie rýchlejšie (varovanie `fast_loss`).
- Ako často sa ukazuje `underfuel` a či po ňom príjem stúpne.
- Používanie paliva a režimu bez počítania u ľudí, ktorí nezapisujú.
