# Denný Instagram obsah pre SelfRace

Návod pre AI (denný task o 9:11). Úpravou tohto súboru zmeníš, čo task robí –
netreba meniť samotný task.

## Úloha

Každý deň priprav **jeden hotový obsah na Instagram** pre @selfrace (slovenské a
české publikum) a obrázky k nemu – buď **príspevok do feedu** (carousel s 2–4 slidmi),
alebo **len story** (1–3 snímky); čo kam, rozhoduje bod 1b. Publikum: ľudia, ktorí behajú (aj trail),
posilňujú, robia OCR/Hyrox alebo sa chcú hýbať pre zdravie.

Fakty o appke ber **len** z `marketing/SELFRACE_PRODUKT.md` (prečítaj celý).
Do repozitára nič necommituj ani nepushuj.

## 1. Aký je dnes deň

Zisti dnešný dátum (Europe/Bratislava) a spočítaj **N = počet dní od 11. 10. 2026**.

- **N párne → deň APPKY** (téma: SelfRace).
- **N nepárne → deň OBSAHU** – typ podľa `((N − 1) / 2) mod 3`:
  - **0 → ZAUJÍMAVOSŤ** – zaujímavá športová udalosť, ktorá sa dá prepojiť s appkou
  - **1 → TIP** (ako na to)
  - **2 → MEM** (vtip zo sveta športu)

Aj v deň obsahu môže byť na konci jemný odkaz na appku (jedna veta), nie reklama.

## 1b. Feed alebo len story

Feed je výklad – kto príde na profil, vidí mriežku a každý príspevok tam má obstáť aj
o mesiac. Do feedu preto **najviac 4 príspevky týždenne**, zvyšok ide len do story.

- **TIP → FEED** (ľudia si ho ukladajú).
- **ZAUJÍMAVOSŤ → FEED**, keď má pointu prepojenú s appkou (bod 4). Čistá správa bez
  pointy (výsledok, „práve beží…“) → **STORY**.
- **APPKA → striedavo:** pozri archív – keď bol posledný deň APPKY vo feede, dnes je
  **STORY**, inak **FEED**.
- **MEM → STORY.** Do feedu len výnimočne silný mem a najviac raz za 2 týždne.
- Keď si nie si istý, **STORY**.

**STORY** = `format: "story"` (1080×1920), 1–3 snímky. Na poslednej nechaj voľné miesto
na anketu alebo otázku (render dáva scénu vpravo dole, ľavý dolný roh ostane voľný) a
napíš presný text ankety. K **FEED** príspevku vždy pridaj aj bonus story (bod 6).

## 2. Čo už bolo (archív)

Pozri si archív: nástroj **Artifact** s `action: "list"` (limit 40) – stránky s názvom
začínajúcim na **„IG “**. Z ich názvov vidíš dátum, typ, FEED/STORY (staršie stránky ho
nemajú = FEED) a tému. **Neopakuj tému toho istého typu z posledných 21 dní.**

## 3. Výskum na webe (WebSearch, max 5 hľadaní)

- Vždy: čo sa práve deje v behu / trailu / OCR / Hyroxe / sile (preteky, rekordy,
  virálne príbehy, nové štúdie) a aktuálne Instagram trendy (formáty, zvuky).
- Udalosti na Slovensku a v Česku v najbližších dňoch, sviatky, ročné obdobie, počasie.
- Používaj len to, čo naozaj nájdeš, s odkazom. Dátumy pretekov a čísla over
  (aspoň 2 zdroje alebo oficiálna stránka). Keď nič nesedí, sprav nadčasovú tému.
- **Aktuálny stav over tesne pred písaním** (jedno hľadanie navyše): pri udalosti, ktorá
  ešte beží alebo sa práve stala (preteky, rekordný pokus, výzva, zranenie športovca),
  hľadaj správy z posledných 24 h – zrušenie, výsledok, zmena. Nikdy nepíš „práve
  beží“ ani „cieľ možno v utorok“ bez overenia, že to ešte platí (Moab 240 bol v čase
  ranného postu už pol dňa zrušený).

## 4. Typy obsahu

### APPKA (každý druhý deň)
Cieľ: aby na to ľudia klikli a boli zvedaví. Ukáž **problém → ako ho rieši SelfRace**.
Nie reklama, ale „aha, to potrebujem“. Začni tým najpodstatnejším, nie detailom.

**Hlavné dôvody** (aspoň 2 z 3 dní appky, striedaj, pozri archív):
- plán, ktorý sa prispôsobí tebe – únava, choroba, vynechaný tréning („Nie ty plánu. Plán tebe.“),
- po tréningu ti AI tréner povie, ako to bolo (pocit po tréningu, terén, tempo),
- **prečo SelfRace / čím sme iní** – nie univerzálny plán z internetu, appka podľa
  zamerania, vyvíja ju bežec, ktorý ju sám používa (približne raz za týždeň),
- vyber si zameranie: Posilňovanie (bez Stravy) · Beh a trail · Beh + sila · OCR a Hyrox · Zdravie,
- režimy AI tréner · Coach / AI tréner · Poradca,
- uvítací týždeň (hodnotenie každej aktivity zo Stravy automaticky a zadarmo).

**Doplnkové** (zvyšné dni): regenerácia (HRV, spánok, pivo) · progres cviku a mesačné
zhrnutie · zdravotný záznam · preteky (odpočet, ladenie formy, odhad časov) · widgety a
Domov podľa seba · séria tréningov · Živý tréner (pripravujeme).

Carousel: **slide 1 = hook** (otázka alebo problém, ktorý user pozná – „Tvoj plán nevie,
ako sa dnes cítiš.“), nie zoznam funkcií · **slide 2 = čo dostaneš** (max 3 body) ·
**posledný = výzva** (uvítací týždeň alebo jedna veta, prečo to skúsiť + „Link v bio ·
selfrace.com“). Rozdiel ukazuj voči univerzálnemu plánu, nie voči konkrétnej appke.
Ak sa dá, naviaž to na aktuálny trend alebo udalosť.

### ZAUJÍMAVOSŤ
Nielen preteky – **akákoľvek zaujímavá športová udalosť alebo príbeh**, ktorý sa dá
prepojiť s appkou: dramatické alebo zrušené preteky, rekord, virálny výkon či výzva,
návrat po zranení, známy športovec a jeho príprava, regenerácia alebo choroba, nová
štúdia, Spartan/Hyrox majstrovstvá, veľký maratón na SK/CZ, počasie a sezóna (prvý sneh,
horúčavy, tma po zmene času).

Hľadaj tému s **pointou, ktorú človek pozná z vlastného tréningu**, a k nej 1–2
funkcie SelfRace, ktoré na ňu sedia (len zo `SELFRACE_PRODUKT.md`). Príklady:
- Moab 240 zrušili pre búrku → vedieť povedať stop je tiež výkon → zdravotný záznam,
  plán sa prispôsobí únave a chorobe,
- maratónec ladí formu pred pretekmi → tapering a odpočet do pretekov,
- víťaz maratónu prezradí, že väčšinu tréningov beží ľahko → 80/20 a pomer ľahkých a
  náročných tréningov,
- hviezda vypadla pre zranenie → riziko zranenia v analýze, sila pre bežcov.

Bez pointy (len správa) to ide do story, nie do feedu (bod 1b).

Carousel **3–4 slidy**:
1. **hook bez prezradenia pointy** – vyvolaj napätie, prečo sa človek dozvie až na
   ďalších slidoch (dobre: „389 km cez púšť. Do cieľa nedobehol nikto.“ / zle: štítok
   „zrušené“ hneď na prvom slide). Pozor aj na `tag` a `lead`,
2. čo je to za udalosť – 2–3 overené čísla,
3. čo sa stalo,
4. pointa + čo s tým urobí SelfRace + „Link v bio · selfrace.com“ (pri 3 slidoch spoj
   2 a 3).

Otázka do komentárov ide do popisu. Popis môže pointu prezradiť – číta sa až po slidoch.

### TIP
Klasika, ktorú ľudia ukladajú: tepové zóny, 80/20, kadencia, beh do kopca, technika
drepu / výpadu / mŕtveho ťahu / zhybu, plank a stred tela, rozcvička, strečing,
regenerácia a spánok, tapering pred pretekmi, úchop pre OCR, ako začať behať, ako začať
posilňovať doma. Konkrétne a jednoducho (carousel „uložiť na neskôr“): problém →
2–3 kroky → „Ulož si to“.

### MEM
Vtip zo sveta športu, s ktorým sa ľudia stotožnia. Použi **známu šablónu memu** a
slovenský text, napr.:
- osamelý Pablo Escobar čaká – „Keď behám sám v daždi“,
- Drake – „hodinky: oddych 72 h“ / „ja: dlhý beh zajtra“,
- „This is fine“ pes – „tretí deň po nohách“,
- Distracted boyfriend – „ja / nové bežky / staré bežky s 900 km“.
Výstup: názov šablóny, presný text hore/dole, kde ho vyrobiť (v Instagrame cez
šablónu, Canva, imgflip). Obrázok šablóny nesťahuj ani nepoužívaj – vyrob
**maskotovú verziu** memu cez render (`layout: "meme"`), ktorú môže user použiť
namiesto šablóny.

## 5. Obrázok

**a) Nové scény s maskotmi (OpenAI).** Vždy skús nakresliť ku každému slidu vlastnú
scénu (najviac 4 volania + 2 opravy) (kľúč je v prostredí ako Network secret alebo `OPENAI_API_KEY`) – maskoti robia presne to, o čom je príspevok
(beží v daždi, drží plank, sedí sám na lavičke ako v meme, pozerá na hodinky…):
- `node marketing/render/gen_scene.cjs --refs <1–3 z: lift, trail, ocr, woman, man, pair> --prompt "<scéna po anglicky: čo robia, póza, rekvizity, nálada>" --out <scratchpad>/scena.png`
- referencie vyber podľa toho, kto má byť na obrázku (žena = woman/lift, muž = man/trail/ocr),
- v scéne žiadny text ani logá, maskoti celí a čitateľní; pri meme parodizuj situáciu
  vlastnou scénou, nekopíruj cudzí obrázok,
- pozri sa na výsledok; keď postavičky nevyzerajú ako maskoti SelfRace, skús raz znova
  s presnejším promptom, inak použi hotového maskota,
- skontroluj **nápis na tričku** – pokrivený nápis („selffracs“, „settrace“) je chyba
  značky, scénu nepoužívaj. Pri oprave pridaj do promptu: „The only text in the whole
  image is the word selfrace on the t-shirt, spelled s-e-l-f-r-a-c-e, clean and centered
  on the chest.“ Štartovné čísla chci prázdne („plain blank white race bib with no
  numbers or letters“), inak na nich bude nezmysel,
- skontroluj **telo postavičiek**: presne 2 ruky a 2 nohy, obe nohy rovnako (obe v
  teniskách alebo obe schované – nie jedna bosá a vedľa vyzuté tenisky), v každej ruke
  najviac jedna vec, nič zdvojené (dva mobily, dve šálky). Chybu vidno hneď, scénu s ňou
  nepoužívaj. Oprava: v prompte napíš, čo drží ktorá ruka, a nohy radšej schovaj (deka,
  stôl). Keď to ani na druhý pokus nevyjde, použi hotového maskota,
- `--quality high` cez proxy padá (502) – nechaj predvolené medium,
- keď skript zlyhá (chýba kľúč, chyba OpenAI), pokračuj s hotovým maskotom a v
  odpovedi napíš prečo.

**b) Hotové slidy.** Každý slide = 1 PNG šablónou `marketing/render/render.cjs` (návod v
hlavičke súboru) – nakreslenú scénu do nej vlož cez `figureFile`:
- `spec.json` a PNG ukladaj do svojho scratchpad priečinka (nie do repa),
- `NODE_PATH=/opt/node22/lib/node_modules node marketing/render/render.cjs <spec_01.json> <selfrace_YYYY-MM-DD_01.png>`
  (ďalšie slidy `_02`, `_03`, `_04`, story `_story`),
- slide 1 (hook): nadpis + krátky `lead`, bez bodov, väčšia scéna `"figureHeight": 740–820`
  (keď sa `lead` dotýka scény, zníž ju),
  `"cta": "Potiahni →"`; stredný slide: max 3 body, `"cta": "Potiahni →"`; posledný:
  `"cta": "Link v bio · selfrace.com"`. Všetky slidy rovnaký `format`, štítok (`tag`) môže
  byť na každom iný,
- `format`: `post` (1080×1350) alebo `story` (1080×1920); pri meme `layout: "meme"`,
- `figure`: lift = sila, trail = beh/trail, ocr = OCR/Hyrox, woman = appka/mobil,
  man = zdravie/motivácia/mem, pair = pre všetkých,
- krátky nadpis (max ~8 slov), najviac 3 body, `strava: true` len pri téme so Strava dátami,
- body majú vždy **zelenú fajku ✓** – zlé veci (búrka, zranenie, chyby v tréningu) do
  bodov nedávaj, vyzerajú ako „splnené“; napíš ich ako `lead` (súvislý text),
- pozri sa na všetky slidy; keď text pretečie, prekrýva sa alebo je slide prázdny, uprav ho a vyrob znova.

## 6. Výstup (po slovensky)

```
📅 <dátum> · <APPKA / ZAUJÍMAVOSŤ / TIP / MEM> · <FEED / STORY> · <téma>

📍 KAM: <FEED alebo STORY a prečo, podľa bodu 1b>
💡 NÁPAD: <jedna veta>
🔥 PREČO TERAZ: <trend / udalosť / sezóna + odkaz na zdroj; pri prebiehajúcej udalosti aj „stav overený <čas>“>
🎬 FORMÁT: <carousel / story> · najlepší čas zverejnenia

HOOK (prvé 2 sekundy / prvý slide): <text>

OBSAH:
<Reel: scéna po scéne – čo natočiť, text na obrazovke, dĺžka>
<Carousel: slide 1…N s textami>
<Mem: šablóna + text hore/dole>

🎵 AUDIO: <typ trendového zvuku / konkrétny, ak ho našiel výskum>

✍️ POPIS (Instagram):
<caption s výzvou na komentár alebo uloženie, na konci „Link v bio · selfrace.com“>

#️⃣ HASHTAGY: <najviac 5 – Instagram viac nepustí: #selfrace + 2 slovenské/české + 2 anglické k téme>

✍️ POPIS (Facebook):
<ten istý text bez hashtagov (najviac 1–2 k téme), namiesto „Link v bio · selfrace.com“
 na konci „👉 https://selfrace.com“ – na Facebooku je odkaz klikateľný>

📲 BONUS STORY: <pri FEED: 1 story s anketou/otázkou, ktorá neprezradí pointu príspevku + „zdieľaj príspevok do story“>
```

Pri **STORY** dni vynechaj oba POPISY a HASHTAGY a pod OBSAH napíš text každej snímky a
presné znenie ankety/otázky.

## 7. Ulož do archívu

1. Pošli všetky PNG userovi (SendUserFile, v poradí slidov).
2. Publikuj **novú** stránku (Artifact) s názvom
   **„IG <YYYY-MM-DD> · <typ> · <FEED/STORY> · <téma>“** (napr. „IG 2026-10-14 · MEM · STORY · Beh v daždi“).
   Vychádzaj zo vzoru `marketing/render/archiv_vzor.html`: skopíruj ho do scratchpadu
   a vymeň len texty v `[hranatých zátvorkách]` a obrázky (počet `<figure>` podľa počtu
   slidov). Obsahuje slidy s tlačidlami **Uložiť** (user ukladá obrázky z mobilu, kde
   sa inak z archívu stiahnuť nedajú), celý výstup z bodu 6 a popis pre Instagram
   (s hashtagmi) aj pre Facebook, každý s tlačidlom Kopírovať. Publikuj s `capabilities: {"downloads": true}` a obrázkami cez
   `files` (súbory zo scratchpadu). Skript na ukladanie nemeň.
   Žiadnu existujúcu stránku neprepisuj ani nemaž.

## Pravidlá

- Tykanie, krátko, ľudsky, s humorom. Žiadne korporátne frázy.
- **Prirodzená hovorová slovenčina**, ako keby to povedal kamarát z behu. Žiadne
  doslovné preklady z angličtiny ani kostrbaté vety – zlý príklad: „HRV dole? Prečo,
  nie len že.“, dobrý: „Včera pivo, dnes HRV dole?“. Nadpis a hook si pred renderom
  prečítaj nahlas; keď neznie ako bežná veta, prepíš ho.
- Slovenské reálie: alkohol = **pivo** (nie víno), posedenie po behu, hory, Tatry.
- AI vždy ako **„AI tréner“**. Režimy: „AI tréner · Coach“, „AI tréner · Poradca“;
  „Živý tréner“ len ako **pripravujeme**.
- Len funkcie z `SELFRACE_PRODUKT.md`. Žiadne ceny, zľavy, čísla userov, vymyslené
  recenzie ani zdravotné sľuby. Fakty zo sveta len overené, s odkazom.
- Strava: „Powered by Strava“ len pri Strava dátach, nikdy „partner Stravy“.
- Maskoti (zelené smajlíky v tričku „selfrace“) sú doplnok, hlavná je myšlienka.
- Odkaz: „Link v bio · selfrace.com“.
