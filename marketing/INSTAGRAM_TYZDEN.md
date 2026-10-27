# Týždenný Instagram obsah pre SelfRace

Návod pre AI (týždenný task, nedeľa večer). Úpravou tohto súboru zmeníš, čo task robí –
netreba meniť samotný task.

## Úloha

Raz týždenne priprav **3 posty do feedu a 1 story na nasledujúci týždeň (pondelok –
nedeľa, každý druhý deň)** pre @selfrace.app (slovenské a české publikum) aj s obrázkami
a textami. PREČO len 4: sledovateľov je zatiaľ málo – radšej menej a lepšie. Viac až
keď o to user požiada. User ich v pondelok
naraz naplánuje v Meta Business Suite (Instagram + Facebook). Publikum: ľudia, ktorí
behajú (aj trail), posilňujú, robia OCR/Hyrox alebo sa chcú hýbať pre zdravie.

Fakty o appke ber **len** z `marketing/SELFRACE_PRODUKT.md` (prečítaj celý).
Do repozitára nič necommituj ani nepushuj.

## 1. Týždenná kostra (pevná)

| Deň | Čas | Typ | Kam |
|---|---|---|---|
| Pondelok | 18:30 | **TIP**, alebo **ZAUJÍMAVOSŤ**, keď je v týždni silná téma s pointou (striedaj podľa archívu) | FEED |
| Streda | 18:30 | **POROVNANIE** bez plánu na mieru / so SelfRace | FEED |
| Piatok | 18:30 | **APPKA** – jeden dôvod alebo funkcia | FEED |
| Nedeľa | 19:00 | **MEM** alebo **ZÁKULISIE / ANKETA** (striedaj podľa archívu) | STORY |

Feed = 3 príspevky týždenne, k tomu 1 story. Feed je výklad – každý príspevok tam
má obstáť aj o mesiac. Ku každému FEED postu stačí po zverejnení **zdieľať post do
story** – napíš k tomu jednu anketu alebo otázku (len text, žiadny ďalší obrázok).

**STORY** = `format: "story"` (1080×1920), 1–3 snímky. Na poslednej nechaj voľné miesto
na anketu alebo otázku (render dáva scénu vpravo dole, ľavý dolný roh ostane voľný) a
napíš presný text ankety.

**Reklama:** na týždennej stránke odporuč, ktorý post z týždňa propagovať (najlepšie
POROVNANIE alebo APPKA, nikdy správu, ktorá zostarne) – alebo napíš, že žiadny.

## 2. Čo už bolo (archív)

Nástroj **Artifact** s `action: "list"` (limit 40): stránky s názvom začínajúcim na
**„IG “**. Staršie sú po jednom poste („IG 2026-10-12 · ZAUJÍMAVOSŤ · …“), nové po
týždňoch („IG týždeň 2026-10-19 – 2026-10-25“). Posledné 3 týždenné stránky si prečítaj
(`action: "read"`) – vidíš v nich témy aj použité dvojice porovnaní.
**Neopakuj tému toho istého typu z posledných 4 týždňov.**

Posty v časti **Rezerva** na týždennej stránke nešli von – ich téma nie je použitá.
Keď sedia do kostry a nezostarli (žiadna správa ani dátum, ktorý už prešiel), použi ich
hotové obrázky aj texty namiesto nových (súbory stiahneš cez Artifact `read` s `path`) a
napíš to do plánu („z rezervy týždňa …“). Ušetríš volania OpenAI.

**Pevne naplánované z minulých týždňov** (má prednosť pred kostrou; po použití riadok
zmaž – to spraví user alebo session, ktorá upravuje návod, task do repa nepíše):
- **týždeň 26. 10. – 1. 11., streda 28. 10.: POROVNANIE #2** zo stránky
  „IG týždeň 2026-10-12 – 2026-10-18“ (https://claude.ai/artifact/V5RxAZuurAVazLxy2byKFz),
  sekcia d6 – 5 slidov `selfrace_2026-10-17_01.png` … `_05.png` a hotové texty. Obrázky
  skopíruj cez `files` ako `{"artifact": "<tá url>", "path": "selfrace_2026-10-17_0N.png"}`,
  novú scénu na stredu nekresli. Popis pre Facebook už je bez odkazu.
- **„Rovnaký pretek. Iný príbeh.“ – prvé gradujúce porovnanie.** Ak ešte nie je na
  žiadnej týždennej stránke, vyrob ho do najbližšieho týždňa (sobota 9:30 alebo podľa
  dohody). Postava: muž `man`. Bubliny a scény (hore bez / dole so, to isté miesto):
  1. Dunaj v Bratislave, ráno, obaja bežia s chuťou (hore papierový plán, dole mobil) –
     „Týždeň 1: plán z internetu a chuť do toho.“ / „Týždeň 1: plán od SelfRace na tvoj pretek.“
  2. atletická dráha, večer – hore ťažké nohy po drepoch, dole ľahký beh –
     „Týždeň 3: včera drepy, dnes intervaly. Nohy z olova.“ / „Týždeň 3: SelfRace posunul intervaly. Nohy svieže.“
  3. futbalové ihrisko, súmrak – hore vyčerpaný na tráve, dole v pohode s loptou –
     „Týždeň 5: futbal navyše. Plán o ňom nevie.“ / „Týždeň 5: futbal je v pláne. Záťaž sedí.“
  4. obývačka, nedeľa – hore drží boľavé koleno, dole s mobilom a valčekom –
     „Týždeň 7: koleno bolí. Plán káže ďalej.“ / „Týždeň 7: SelfRace ukázal riziko – týždeň ľahšie.“
  5. cieľ polmaratónu (nafukovacia brána bez nápisov) – hore zranený na obrubníku s barlou,
     dole v cieli s medailou – „Deň pretekov: zranený, len sa pozerá.“ /
     „Deň pretekov: forma vyladená, v cieli s úsmevom.“
  6. záver: „Rovnaký pretek. Iný príbeh.“ / „Pripravuj sa na preteky so SelfRace.“
  Popis: „Rovnaký pretek. Rovnaký štart. Iný koniec. 👇“ + krátko príbeh oboch + „Kým si
  bližšie ty? Napíš 1 alebo 2 👇“. Story anketa: „Stalo sa ti to?“ – Áno, presne toto /
  Zatiaľ nie 😅.

## 3. Výskum na webe (WebSearch, max 8 hľadaní na týždeň)

- Vždy: čo sa práve deje v behu / trailu / OCR / Hyroxe / sile (preteky, rekordy,
  virálne príbehy, nové štúdie) a aktuálne Instagram trendy (formáty, zvuky).
- Udalosti na Slovensku a v Česku v najbližších dňoch, sviatky, ročné obdobie, počasie.
- Používaj len to, čo naozaj nájdeš, s odkazom. Dátumy pretekov a čísla over
  (aspoň 2 zdroje alebo oficiálna stránka). Keď nič nesedí, sprav nadčasovú tému.
- **Posty idú von až o 1–7 dní.** ZAUJÍMAVOSŤ preto vyber tak, aby v deň zverejnenia
  ešte platila: udalosť, ktorá sa v ten týždeň len chystá (s dátumom), alebo príbeh,
  ktorý sa už skončil a nezmení sa. Nikdy nepíš „práve beží“ ani „cieľ možno v utorok“
  (Moab 240 bol v čase ranného postu už pol dňa zrušený). Pri udalosti napíš na
  týždennú stránku: „pred zverejnením over, či platí: <čo>“.

## 4. Typy obsahu

### APPKA (piatok)
Cieľ: aby na to ľudia klikli a boli zvedaví. Ukáž **problém → ako ho rieši SelfRace**.
Nie reklama, ale „aha, to potrebujem“. Začni tým najpodstatnejším, nie detailom.

**Hlavné dôvody** (aspoň 2 z 3 týždňov, striedaj, pozri archív):
- plán, ktorý sa prispôsobí tebe – únava, choroba, vynechaný tréning („Nie ty plánu. Plán tebe.“),
- po tréningu ti SelfRace povie, ako to bolo (pocit po tréningu, terén, tempo),
- **prečo SelfRace / čím sme iní** – nie univerzálny plán z internetu, appka podľa
  zamerania, vyvíja ju bežec, ktorý ju sám používa (približne raz za týždeň),
- vyber si zameranie: Posilňovanie (bez Stravy) · Beh a trail · Beh + sila · OCR a Hyrox · Zdravie,
- režimy AI tréner · Coach / AI tréner · Poradca,
- uvítací týždeň (hodnotenie každej aktivity zo Stravy automaticky a zadarmo).

**Doplnkové** (zvyšné týždne): regenerácia (HRV, spánok, pivo) · progres cviku a mesačné
zhrnutie · zdravotný záznam · preteky (odpočet, ladenie formy, odhad časov) · widgety a
Domov podľa seba · séria tréningov · Živý tréner (pripravujeme).

Carousel: **slide 1 = hook** (otázka alebo problém, ktorý user pozná – „Tvoj plán nevie,
ako sa dnes cítiš.“), nie zoznam funkcií · **slide 2 = čo dostaneš** (max 3 body) ·
**posledný = výzva** (uvítací týždeň alebo jedna veta, prečo to skúsiť + „Link v bio ·
selfrace.com“). Rozdiel ukazuj voči univerzálnemu plánu, nie voči konkrétnej appke.
Ak sa dá, naviaž to na aktuálny trend alebo udalosť.

### POROVNANIE bez plánu na mieru / so SelfRace (streda)
Carousel **6 slidov, ktorý GRADUJE** – príbeh dvoch ľudí s rovnakým cieľom (preteky,
schudnúť, silnejší drep…) cez niekoľko týždňov. Slidy 1–5 sú rozdelené na dve polovice:
hore ten **bez plánu na mieru** (univerzálny plán, plán z internetu), dole ten **so
SelfRace**, vždy na **tom istom mieste**. Nepíš „bez SelfRace“ – plán na mieru vie dať aj
dobrý živý tréner. Čítateľ musí chcieť vedieť, ako to dopadne:

1. **štart** – obaja v pohode, rovnaká motivácia („Týždeň 1: …“),
2. **prvý problém** – hore sa začína únava, lebo plán nerieši nič; dole SelfRace zareaguje,
3. **problém rastie** – ďalšia vec navyše (aktivita mimo plánu, choroba, zlá noc), hore
   únava rastie, dole SelfRace sleduje záťaž a plán sa prispôsobí,
4. **vrchol** – hore varovanie, ktoré ignoruje (bolesť, prepadnutá regenerácia), dole
   SelfRace uberie včas,
5. **výsledok** – hore niečo stratil (zranenie, žiadny progres, stratený čas, chuť to
   vzdať), dole niečo získal (v cieli, progres, chuť pokračovať) – príbeh, nie sľub,
6. **záver** – ten istý obrázok dvojice s mobilom (`compare-end`), ale **text patrí k
   príbehu** („Rovnaký pretek. Iný príbeh.“ / „Pripravuj sa na preteky so SelfRace.“),
   nikdy všeobecná fráza ani ponuka.

Na každom slide 1–5 začni bublinu časom („Týždeň 3:“, „Deň pretekov:“), aby bolo vidno
posun. Postava hore vyzerá od slidu k slidu horšie (úsmev → únava → vyčerpanie → bolesť →
smútok), dole ostáva v pohode.

**Témy od najväčších ťahákov** (len funkcie zo `SELFRACE_PRODUKT.md`). Ber najvyššie
z poradia, ktoré neboli posledných 6 týždňov; v jednom príbehu 3–4 funkcie, každý slide
problému = jedna funkcia:
1. plán sa prispôsobí únave a zlej noci (ranný zápis: spánok, HRV, tep),
2. choroba / prechladnutie – zapíšeš ju a plán sa prispôsobí,
3. zranenie / bolesť – zdravotný záznam,
4. preteky – ladenie formy pred pretekmi, odpočet, odhad časov,
5. vynechaný tréning – plán sa preskladá,
6. hodnotenie po tréningu – pomalý kilometer do kopca nie je únava,
7. pivo / alkohol – AI rozlíši „HRV dole po pive“ od „tretí deň bez príčiny“,
8. beh + sila – SelfRace stráži, aby na kľúčový beh nešiel s ťažkými nohami,
9. futbal, svadba, sťahovanie – plán počíta s aktivitami mimo plánu,
10. posilňovanie bez Stravy – denník, šablóny, progres cviku,
11. menštruácia – zapíšeš ju a plán sa prispôsobí (citlivo, bez detailov),
12. analýza športovca v nedeľu – riziko zranenia, trénovanosť,
13. pomer ľahkých a náročných tréningov (80/20),
14. mesačné zhrnutie a séria tréningov,
15. zameranie Zdravie – SelfRace hovorí normálnou rečou, bez žargónu.

**Už použité dvojice** (rovnakú situáciu nedávaj 6 týždňov, tú istú tému v inej situácii
áno): 13. 8. – zlá noc/ťažký tréning, choroba (oddych), únava pred silovým, odpálené telo
v deň pretekov · 17. 10. – krátka noc/intervaly, boľavé koleno, týždeň vynechaných
tréningov, pomalý beh do kopca.

**Texty bublín:** krátka hovorová veta, najviac ~50 znakov. Hore problém („Koleno bolí.
Plán z internetu káže 15 km.“), dole riešenie so SelfRace („Zapíšeš zranenie a plán sa
prispôsobí.“). Žiadne zdravotné sľuby. Slide 6 (záver): hore pointa príbehu, dole výzva
k téme príbehu, bez ponuky.

**Obrázky:** ku každému slidu 1–5 dve scény s pozadím (bod 5c) – 10 volaní OpenAI – najprv „bez“, potom „so“
s obrázkom „bez“ ako referenciou, aby sedelo miesto. Miesta striedaj: Bratislava (hrad,
Dunaj, UFO most, Kamzík), Tatry, Malá Fatra, Košice, Praha, Brno, posilňovňa, obývačka,
spálňa, park. Striedaj maskota (muž `man`, žena `woman`).

### ZAUJÍMAVOSŤ (pondelok namiesto TIPu)
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

Bez pointy (len správa) to do feedu nedávaj – v pondelok bude radšej TIP.

Carousel **3–4 slidy**:
1. **hook bez prezradenia pointy** – vyvolaj napätie, prečo sa človek dozvie až na
   ďalších slidoch (dobre: „389 km cez púšť. Do cieľa nedobehol nikto.“ / zle: štítok
   „zrušené“ hneď na prvom slide). Pozor aj na `tag` a `lead`,
2. čo je to za udalosť – 2–3 overené čísla,
3. čo sa stalo,
4. pointa + čo s tým urobí SelfRace + „Link v bio · selfrace.com“ (pri 3 slidoch spoj
   2 a 3).

Otázka do komentárov ide do popisu. Popis môže pointu prezradiť – číta sa až po slidoch.

### TIP (pondelok)
Klasika, ktorú ľudia ukladajú: tepové zóny, 80/20, kadencia, beh do kopca, technika
drepu / výpadu / mŕtveho ťahu / zhybu, plank a stred tela, rozcvička, strečing,
regenerácia a spánok, tapering pred pretekmi, úchop pre OCR, ako začať behať, ako začať
posilňovať doma. Konkrétne a jednoducho (carousel „uložiť na neskôr“): problém →
2–3 kroky → „Ulož si to“.

### MEM (nedeľa, story – striedavo so ZÁKULISÍM)
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

### ZÁKULISIE / ANKETA (nedeľa, story – striedavo s MEMOM)
1–2 story snímky: appku robí jeden bežec (po nociach, pre seba, používa ju každý deň),
čo pribudlo v appke (len to, čo je v `SELFRACE_PRODUKT.md`), alebo otázka na ľudí
(„Čo by ti v appke pomohlo?“, „Aký cieľ máš na budúci týždeň?“). Na poslednej snímke
miesto na nálepku Otázka alebo Anketa a jej presné znenie.

## 5. Obrázok

**Rozpočet na týždeň:** najviac 20 volaní OpenAI (1 porovnanie = 8 scén, zvyšok na
ostatné posty a opravy). Púšťaj ich naraz po 4 (`&` + `wait`), každé trvá ~1 minútu.

**a) Nové scény s maskotmi (OpenAI).** Skús nakresliť vlastnú scénu ku slidom, kde to
dáva zmysel (kľúč je v prostredí ako Network secret alebo `OPENAI_API_KEY`) – maskoti robia presne to, o čom je príspevok
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

**c) POROVNANIE bez plánu na mieru / so SelfRace.** Scény s pozadím na šírku (1536×1024):
- „bez“: `node marketing/render/gen_scene.cjs --scene --plain-shirt --refs man --prompt "<miesto, svetlo; maskot unavený / v bolesti / zmätený, čo robí>" --out <scratchpad>/bez1.png`
- „so“: `node marketing/render/gen_scene.cjs --scene --refs man --ref-file <scratchpad>/bez1.png --prompt "Same <miesto>, same light. <maskot spokojný, čo robí – mobil najviac v jednej ruke>" --out <scratchpad>/so1.png`
- **Výraz postavy „bez“ je na všetkých slidoch rovnaký:** jednoduchý smajlík – dve okrúhle
  čierne bodky (oči otvorené), jedno ustarostené zdvihnuté obočie, malé zamračené ústa,
  pri únave pár kvapiek potu. Nie plač, privreté oči ani prehnaná grimasa. Do promptu:
  „Face style: simple smiley face with two round black dot eyes, one worried raised
  eyebrow and a small sad frown, eyes open, not crying.“ Scénu s iným výrazom kresli znova.
- „bez“ má tričko bez nápisu, „so“ s nápisom selfrace. Skontroluj, že miesto sedí, a
  telo aj nápis ako v bode a). Spodok scény zakryje bublina – nič dôležité tam nedávaj,
- slide 1–5: `{"layout": "compare", "panels": [{"image": ".../bez1.png", "caption": "…"}, {"image": ".../so1.png", "caption": "…"}]}`,
- slide 6: `{"layout": "compare-end", "top": "<pointa príbehu>", "bottom": "<výzva k téme príbehu>"}`
  (obrázok `marketing/assets/porovnanie_koniec.webp` je v šablóne natrvalo).
- **Porovnanie robí aj verziu 9:16 na reklamu** (Reels/Stories – Meta ju ponúka o ~30 %
  lacnejšie): tie isté spec-y s `"format": "story"` (1080×1920) – scény ostanú celé,
  bubliny sú mimo ovládania Instagramu. Súbory `selfrace_<dátum>_916_01.png` … `_06.png`,
  na stránke pod 4:5 slidmi ako samostatný riadok „Na reklamu 9:16 (Reels a Stories)“
  s tlačidlami Uložiť. Do feedu ide 4:5, do reklamy oba formáty (Meta si vyberie podľa
  umiestnenia). Pozri sa aj na 9:16 – text nesmie zakryť tvár.

## 6. Výstup ku každému postu (po slovensky)

Na týždennú stránku (bod 7) ku každému dňu:
- deň, čas, typ, FEED/STORY, téma a nápad jednou vetou (pri udalosti zdroj a „pred
  zverejnením over: …“),
- obrázky v poradí slidov, pri porovnaní aj 9:16 verzia na reklamu (bod 5c),
- **popis pre Instagram** – výzva na komentár alebo uloženie, na konci „Link v bio ·
  selfrace.com“, potom **najviac 5 hashtagov** (viac Instagram nepustí): #selfrace +
  2 slovenské/české + 2 anglické k téme,
- **popis pre Facebook** – ten istý text bez hashtagov, **bez odkazu v texte** (stránka bez
  Meta One môže mať odkaz len v 2 príspevkoch mesačne), na konci „👉 Odkaz nájdeš v
  komentári“. Pod popis napíš riadok „Prvý komentár: https://selfrace.com“ – user ho
  pridá a pripne hneď po zverejnení,
- **story** – presné znenie ankety alebo otázky; pri FEED „potom zdieľaj post do story“,
- pri MEM aj názov známej šablóny a text hore/dole (kto chce, vyrobí ho v Instagrame).

Pri STORY dni oba popisy vynechaj.

## 7. Týždenná stránka

1. Publikuj **jednu novú** stránku (Artifact) s názvom
   **„IG týždeň <YYYY-MM-DD> – <YYYY-MM-DD>“** (pondelok – nedeľa).
   Vychádzaj zo vzoru `marketing/render/tyzden_vzor.html`: skopíruj ho do scratchpadu,
   vyplň tabuľku plánu a blok `<section class="post">` zopakuj pre každý zo 4 dní (id d1–d4).
   Obrázky pomenuj `selfrace_<dátum dňa>_01.png`… (story `_story_01.png`) a pridaj ich
   cez `files`. Publikuj s `capabilities: {"downloads": true}` – bez nej sa obrázky
   nedajú uložiť z mobilu. Skript na ukladanie a kopírovanie nemeň.
   Žiadnu existujúcu stránku neprepisuj ani nemaž.
2. Userovi pošli (SendUserFile) len prvý slide porovnania ako náhľad a v odpovedi
   odkaz na stránku + tabuľku plánu. Ostatné si stiahne zo stránky.

## Pravidlá

- Tykanie, krátko, ľudsky, s humorom. Žiadne korporátne frázy.
- **Prirodzená hovorová slovenčina**, ako keby to povedal kamarát z behu. Žiadne
  doslovné preklady z angličtiny ani kostrbaté vety – zlý príklad: „HRV dole? Prečo,
  nie len že.“, dobrý: „Včera pivo, dnes HRV dole?“. Nadpis a hook si pred renderom
  prečítaj nahlas; keď neznie ako bežná veta, prepíš ho.
- Slovenské reálie: alkohol = **pivo** (nie víno), posedenie po behu, hory, Tatry.
- **Predávame appku ako celok, nie AI trénera.** V bublinách, nadpisoch aj popisoch
  píš „plán od SelfRace“, „SelfRace posunul / zhodnotil / ukázal / pomôže“ – nie „AI
  tréner“. Výrazy drž v rovnakom štýle naprieč slidmi aj postami. „AI tréner“ len pri
  názve režimu („AI tréner · Coach“, „AI tréner · Poradca“), keď o režimoch post naozaj
  je; „Živý tréner“ len ako **pripravujeme**.
- Len funkcie z `SELFRACE_PRODUKT.md`. Žiadne ceny, zľavy, čísla userov, vymyslené
  recenzie ani zdravotné sľuby. Fakty zo sveta len overené, s odkazom.
- Strava: „Powered by Strava“ len pri Strava dátach, nikdy „partner Stravy“.
- Maskoti (zelené smajlíky v tričku „selfrace“) sú doplnok, hlavná je myšlienka.
- Odkaz: „Link v bio · selfrace.com“.
- **Ponuky (prvý mesiac PRO zadarmo, akcie, „limitovaná kapacita“) nikdy do feed postov
  ani ich popisov – len do story.** PREČO: feed post ostáva na profile mesiace a podmienky
  sa môžu zmeniť (napr. mesiac → 2 týždne); SelfRace sa nepredáva cez „zadarmo“, ale cez
  to, čo appka robí. Výnimka: uvítací týždeň ako funkcia (hodnotenie aktivít) môže byť
  spomenutý, ale nie ako hlavný ťahák.
