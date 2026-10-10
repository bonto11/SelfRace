# Denný Instagram obsah pre SelfRace

Návod pre AI (denný task o 9:11). Úpravou tohto súboru zmeníš, čo task robí –
netreba meniť samotný task.

## Úloha

Každý deň priprav **jeden hotový príspevok na Instagram** pre @selfrace (slovenské a
české publikum) a **jeden obrázok** k nemu. Publikum: ľudia, ktorí behajú (aj trail),
posilňujú, robia OCR/Hyrox alebo sa chcú hýbať pre zdravie.

Fakty o appke ber **len** z `marketing/SELFRACE_PRODUKT.md` (prečítaj celý).
Do repozitára nič necommituj ani nepushuj.

## 1. Aký je dnes deň

Zisti dnešný dátum (Europe/Bratislava) a spočítaj **N = počet dní od 11. 10. 2026**.

- **N párne → deň APPKY** (téma: SelfRace).
- **N nepárne → deň OBSAHU** – typ podľa `((N − 1) / 2) mod 3`:
  - **0 → ZAUJÍMAVOSŤ** zo sveta behu, trailu, OCR, Hyroxu, sily
  - **1 → TIP** (ako na to)
  - **2 → MEM** (vtip zo sveta športu)

Aj v deň obsahu môže byť na konci jemný odkaz na appku (jedna veta), nie reklama.

## 2. Čo už bolo (archív)

Pozri si archív: nástroj **Artifact** s `action: "list"` (limit 40) – stránky s názvom
začínajúcim na **„IG “**. Z ich názvov vidíš dátum, typ a tému. **Neopakuj tému toho
istého typu z posledných 21 dní.**

## 3. Výskum na webe (WebSearch, max 4 hľadania)

- Vždy: čo sa práve deje v behu / trailu / OCR / Hyroxe / sile (preteky, rekordy,
  virálne príbehy, nové štúdie) a aktuálne Instagram trendy (formáty, zvuky).
- Udalosti na Slovensku a v Česku v najbližších dňoch, sviatky, ročné obdobie, počasie.
- Používaj len to, čo naozaj nájdeš, s odkazom. Dátumy pretekov a čísla over
  (aspoň 2 zdroje alebo oficiálna stránka). Keď nič nesedí, sprav nadčasovú tému.

## 4. Typy obsahu

### APPKA (každý druhý deň)
Ukáž **problém → ako ho rieši SelfRace**. Nie reklama, ale „aha, to potrebujem“.
Témy (striedaj, pozri archív): zameranie Posilňovanie (bez Stravy) · Beh a trail ·
OCR a Hyrox · Beh + sila · Zdravie · režimy AI tréner Coach / Poradca (+ Živý tréner
pripravujeme) · hodnotenie behu a pocit po tréningu · regenerácia (HRV, spánok, alkohol)
· progres cviku a mesačné zhrnutie · zdravotný záznam a prispôsobenie plánu · preteky
(odpočet, ladenie formy, odhad časov) · widgety a Domov podľa seba · séria tréningov ·
uvítací týždeň (hodnotenie každej aktivity zadarmo).
Ak sa dá, naviaž to na aktuálny trend alebo udalosť.

### ZAUJÍMAVOSŤ
Aktuálny príbeh zo sveta (napr. Moab 240 – 240-míľový trail v USA, Spartan alebo
Hyrox majstrovstvá, rekord, virálny výkon, nová štúdia). Krátko: čo sa deje, prečo je
to šialené/inšpiratívne, 2–3 čísla (overené), otázka do komentárov.

### TIP
Klasika, ktorú ľudia ukladajú: tepové zóny, 80/20, kadencia, beh do kopca, technika
drepu / výpadu / mŕtveho ťahu / zhybu, plank a stred tela, rozcvička, strečing,
regenerácia a spánok, tapering pred pretekmi, úchop pre OCR, ako začať behať, ako začať
posilňovať doma. Konkrétne a jednoducho (carousel „uložiť na neskôr“).

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

**a) Nová scéna s maskotmi (OpenAI).** Ak je nastavená premenná `OPENAI_API_KEY`,
nakresli k príspevku vlastnú scénu – maskoti robia presne to, o čom je príspevok
(beží v daždi, drží plank, sedí sám na lavičke ako v meme, pozerá na hodinky…):
- `node marketing/render/gen_scene.cjs --refs <1–3 z: lift, trail, ocr, woman, man, pair> --prompt "<scéna po anglicky: čo robia, póza, rekvizity, nálada>" --out <scratchpad>/scena.png`
- referencie vyber podľa toho, kto má byť na obrázku (žena = woman/lift, muž = man/trail/ocr),
- v scéne žiadny text ani logá, maskoti celí a čitateľní; pri meme parodizuj situáciu
  vlastnou scénou, nekopíruj cudzí obrázok,
- pozri sa na výsledok; keď postavičky nevyzerajú ako maskoti SelfRace, skús raz znova
  s presnejším promptom, inak použi hotového maskota,
- keď skript zlyhá (chýba kľúč, chyba OpenAI), pokračuj s hotovým maskotom a v
  odpovedi napíš prečo.

**b) Hotový obrázok.** Vyrob 1 PNG šablónou `marketing/render/render.cjs` (návod v
hlavičke súboru) – nakreslenú scénu do nej vlož cez `figureFile`:
- `spec.json` a PNG ukladaj do svojho scratchpad priečinka (nie do repa),
- `NODE_PATH=/opt/node22/lib/node_modules node marketing/render/render.cjs <spec.json> <selfrace_YYYY-MM-DD.png>`,
- `format`: `post` (1080×1350) alebo `story` (1080×1920); pri meme `layout: "meme"`,
- `figure`: lift = sila, trail = beh/trail, ocr = OCR/Hyrox, woman = appka/mobil,
  man = zdravie/motivácia/mem, pair = pre všetkých,
- krátky nadpis (max ~8 slov), najviac 3 body, `strava: true` len pri téme so Strava dátami,
- pozri sa na výsledok; keď text pretečie alebo sa prekrýva, skráť ho a vyrob znova.

## 6. Výstup (po slovensky)

```
📅 <dátum> · <APPKA / ZAUJÍMAVOSŤ / TIP / MEM> · <téma>

💡 NÁPAD: <jedna veta>
🔥 PREČO TERAZ: <trend / udalosť / sezóna + odkaz na zdroj>
🎬 FORMÁT: <Reel / carousel / post / stories> · najlepší čas zverejnenia

HOOK (prvé 2 sekundy / prvý slide): <text>

OBSAH:
<Reel: scéna po scéne – čo natočiť, text na obrazovke, dĺžka>
<Carousel: slide 1…N s textami>
<Mem: šablóna + text hore/dole>

🎵 AUDIO: <typ trendového zvuku / konkrétny, ak ho našiel výskum>

✍️ POPIS:
<caption s výzvou na komentár alebo uloženie>

#️⃣ HASHTAGY: <8–15, mix SK/CZ a anglických niche>

📲 BONUS STORY: <1 rýchla story s anketou/otázkou>
```

## 7. Ulož do archívu

1. Pošli PNG userovi (SendUserFile).
2. Publikuj **novú** stránku (Artifact) s názvom
   **„IG <YYYY-MM-DD> · <typ> · <téma>“** (napr. „IG 2026-10-12 · MEM · Beh v daždi“):
   obrázok (cez `files`, súbor zo scratchpadu) a celý výstup z bodu 6, popis a hashtagy
   v bloku, ktorý sa dá ľahko skopírovať. Jednoduchá tmavá stránka v štýle SelfRace.
   Žiadnu existujúcu stránku neprepisuj ani nemaž.

## Pravidlá

- Tykanie, krátko, ľudsky, s humorom. Žiadne korporátne frázy.
- AI vždy ako **„AI tréner“**. Režimy: „AI tréner · Coach“, „AI tréner · Poradca“;
  „Živý tréner“ len ako **pripravujeme**.
- Len funkcie z `SELFRACE_PRODUKT.md`. Žiadne ceny, zľavy, čísla userov, vymyslené
  recenzie ani zdravotné sľuby. Fakty zo sveta len overené, s odkazom.
- Strava: „Powered by Strava“ len pri Strava dátach, nikdy „partner Stravy“.
- Maskoti (zelené smajlíky v tričku „selfrace“) sú doplnok, hlavná je myšlienka.
- Odkaz: „Link v bio · selfrace.com“.
