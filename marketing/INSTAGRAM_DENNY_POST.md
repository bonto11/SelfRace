# Denný Instagram obsah pre SelfRace

Návod pre AI (denný task). Úpravou tohto súboru zmeníš, čo task robí – netreba
meniť samotný task.

## Úloha

Každý deň priprav **jeden hotový nápad na Instagram** pre @selfrace (slovenské a
české publikum) a **jeden obrázok** k nemu. Cieľ: ľudia, ktorí behajú, posilňujú,
robia OCR/Hyrox alebo sa chcú hýbať pre zdravie, si povedia „to je pre mňa“.

Fakty o appke ber **len** z `marketing/SELFRACE_PRODUKT.md` (prečítaj celý).
Nič do repozitára necommituj ani nepushuj.

## Postup

1. **Dátum:** zisti dnešný dátum a deň v týždni (Europe/Bratislava).
2. **Trendy – vyhľadaj na webe (WebSearch)**, max 4 hľadania:
   - aktuálne Instagram trendy tento týždeň/mesiac (formáty Reels, trendové audio, memy),
   - fitness/bežecké trendy a témy, o ktorých sa práve hovorí,
   - športové udalosti na Slovensku a v Česku v najbližších dňoch (maratóny, trail, Spartan, Hyrox),
   - sviatky, ročné obdobie, počasie, „národné dni“ súvisiace s pohybom.
   Použi len to, čo naozaj nájdeš, a uveď zdroj (odkaz). Keď nič nesedí, sprav nadčasový nápad – nevymýšľaj trend.
3. **Téma podľa dňa** (aby sa obsah striedal):
   - **Pondelok** – tip/edukácia (tréning, regenerácia, spánok) + ako s tým pomôže appka
   - **Utorok** – funkcia appky v praxi (čo natočiť zo screenu mobilu)
   - **Streda** – mýtus vs. realita
   - **Štvrtok** – trendový formát (Reel s trendovým audiom / mem)
   - **Piatok** – zameranie týždňa: podľa čísla týždňa v roku (ISO) mod 5 → 0 Posilňovanie, 1 Beh a trail, 2 OCR a Hyrox, 3 Beh + sila, 4 Zdravie
   - **Sobota** – víkend, preteky, outdoor (podľa nájdených udalostí)
   - **Nedeľa** – story deň: anketa/kvíz/otázka, plán na nový týždeň
   Ak je v ten deň silná príležitosť (veľké preteky, sviatok, virálny trend), môžeš tému zmeniť – napíš prečo.
4. **Formát:** Reel, carousel, jeden post alebo séria stories – vyber, čo sa na tému hodí najviac.
5. **Obrázok:** vyrob 1 PNG šablónou `marketing/render/render.cjs` (návod v hlavičke súboru):
   - zapíš `spec.json` do priečinka mimo repa (napr. `/tmp`),
   - `NODE_PATH=/opt/node22/lib/node_modules node marketing/render/render.cjs /tmp/spec.json /tmp/selfrace_<YYYY-MM-DD>.png`,
   - `format`: `story` pre stories, inak `post`; `figure` podľa témy (lift = sila, trail = beh, ocr = OCR, woman = appka/mobil, man = zdravie/motivácia, pair = pre všetkých),
   - krátky nadpis (max ~8 slov), najviac 3 body, `strava: true` len pri téme so Strava dátami,
   - pozri sa na výsledok; keď text pretečie alebo sa prekrýva, skráť ho a vyrob znova,
   - pošli PNG userovi (SendUserFile). Keď sa nedá, napíš, kde súbor je.

## Výstup (po slovensky)

```
📅 <dátum> · <téma dňa>

💡 NÁPAD: <jedna veta>
🔥 PREČO TERAZ: <trend / udalosť / sezóna + odkaz na zdroj>
🎬 FORMÁT: <Reel / carousel / post / stories> · najlepší čas zverejnenia

HOOK (prvé 2 sekundy / prvý slide): <text>

OBSAH:
<Reel: scéna po scéne – čo natočiť (mobil, appka na obrazovke, tréning), text na obrazovke, dĺžka>
<Carousel: slide 1…N s textami>
<Stories: rámec 1…N + interaktívna nálepka (anketa, kvíz, slider, otázka)>

🎵 AUDIO: <typ trendového zvuku / konkrétny, ak ho našiel výskum>

✍️ POPIS:
<caption s výzvou na komentár alebo uloženie>

#️⃣ HASHTAGY: <8–15, mix SK/CZ a anglických niche (#behame #posilnovanie #trailrunning …)>

📲 BONUS STORY NA DNES: <1 rýchla story s anketou/otázkou>
```

## Pravidlá

- Tykanie, krátko, ľudsky, s humorom. Žiadne korporátne frázy, žiadny žargón pri zameraní Zdravie.
- AI vždy ako **„AI tréner“**. Režimy: „AI tréner · Coach“, „AI tréner · Poradca“; „Živý tréner“ len ako **pripravujeme**.
- Len funkcie z `SELFRACE_PRODUKT.md`. Žiadne ceny, zľavy, čísla userov, vymyslené recenzie ani zdravotné sľuby.
- Strava: „Powered by Strava“ len pri Strava dátach, nikdy „partner Stravy“.
- Maskoti (zelené smajlíky v tričku „selfrace“) sú doplnok, hlavná je myšlienka.
- Neopakuj stále tú istú tému – striedaj zamerania (Posilňovanie, Beh a trail, OCR a Hyrox, Beh + sila, Zdravie) a typy obsahu.
- Odkaz: „Link v bio · selfrace.com“.
