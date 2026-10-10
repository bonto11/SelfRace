# SelfRace – čo appka robí

Podklad pre marketing a pre AI, ktorá pripravuje obsah na sociálne siete.
Všetko tu zodpovedá tomu, čo appka reálne vie. Čo tu nie je, netvrď.

---

## V skratke

**SelfRace je AI tréner v mobile** pre ľudí, ktorí behajú, posilňujú, chystajú sa na
prekážkové preteky alebo sa chcú len pravidelne hýbať. Plány a hodnotenia pripravuje
AI tréner podľa tvojich dát, cieľa a toho, ako sa cítiš.

- Web appka (PWA) na **selfrace.com** – pridáš si ju na plochu, funguje ako appka v mobile (iPhone aj Android) aj na počítači.
- Pre slovenský a český trh, appka je v **slovenčine, češtine a angličtine**.
- Dáta z behu, bicykla, chôdze a iných športov prichádzajú zo **Stravy** (hodinky alebo mobil). Silový tréning si zapisuješ priamo v appke – na ten Strava netreba.
- Voliteľne sa dá prepojiť **intervals.icu** (ranná regenerácia z hodiniek).
- Vyvíja ju jeden človek – bežec, ktorý ju začal programovať po nociach pre seba a dnes ju sám používa každý deň. Funkcie sa dajú vypýtať – stačí napísať.

**Príbeh a hodnoty** (z „Náš príbeh“ v appke):
- Od športovca, pre športovcov – nevznikla v marketingovej agentúre, ale vonku cez longruny.
- Bežec nie je len o nohách – appka stojí na rovnováhe behu, sily a ďalších športov.
- Šport nie je trest, ale výsada – cieľom je tešiť sa na každý tréning.
- Neporovnávame sa s ostatnými – jediný súper je tvoje včerajšie ja.
- Komunita: „Poďme sa zlepšovať. Spoločne, ale každý vo svojom tempe.“

**Slogany, ktoré používame:**
- „Tvoj tréner, tvoje dáta, tvoja cesta.“
- „Prestaň byť otrokom univerzálnych plánov.“
- „Stiahni SelfRace a trénuj tak, ako tvoje telo potrebuje.“

---

## Zamerania – pre koho to je

Pri prvom spustení si user vyberie zameranie. Appka mu podľa neho ukáže len to, čo
potrebuje, a AI tréner podľa neho hodnotí. Zameranie sa dá kedykoľvek zmeniť a
jednotlivé widgety si každý poskladá podľa seba (Domov = obľúbené).

| Zameranie | Pre koho | Čo dostane | Čo potrebuje |
|---|---|---|---|
| **Posilňovanie** | zapisuje si cviky, série a váhy | denník tréningov, šablóny, progres cviku (váha aj opakovania), AI tréner skontroluje týždeň a doplní vhodné kardio, mesačné zhrnutie s najlepšími výkonmi | len mobil, Strava netreba |
| **Beh a trail** | behá po ceste aj v teréne | plán od AI trénera na mieru, hodnotenie každého behu, tempá, zóny, odhady časov na preteky, plán sa prispôsobí únave a chorobe | Strava (hodinky alebo len mobil) |
| **Beh + sila** | behá a k tomu posilňuje | beh aj sila v jednom pláne, AI tréner stráži, aby na kľúčový beh nešiel s ťažkými nohami, objem sily po svalových partiách | Strava + zápisy sily v appke |
| **OCR a Hyrox** | chystá sa na Spartan, Tough Mudder, Hyrox | beh aj sila v jednom pláne, dôraz na úchop, nosenie, výpady a terén, AI tréner zhodnotí pripravenosť na tento mix, odpočet do pretekov a ladenie formy | Strava + zápisy sily v appke |
| **Zdravie** | hýbe sa pre zdravie, nie pre výkon | ľahké tréningy – kardio aj sila, chôdza, turistika, jóga, cvičenie doma, ide o pravidelnosť, AI tréner hovorí normálnou rečou bez žargónu | mobil; Strava na chôdzu/beh, silu zapíše v appke |
| **Všetko** | chce vidieť celú appku | všetky widgety | – |

---

## Režimy – kto ťa vedie

| Režim | Ako funguje |
|---|---|
| **AI tréner · Coach** | AI tréner poskladá plán na mieru (týždenný aj denný) a sám ho upravuje podľa únavy, pocitov, regenerácie a zdravia. |
| **AI tréner · Poradca** | Tréningy si skladáš sám alebo zo šablón. AI tréner ti skontroluje týždeň („Skontroluj mi týždeň“), poradí, čo doplniť (návrhy idú pridať jedným ťuknutím), a ohodnotí tréningy. Sám v pláne nič nemení. |
| **Živý tréner** | **Pripravujeme.** Skutočný tréner uvidí tvoje dáta, upraví ti plán a ku každému tréningu si môžete písať. V marketingu vždy ako „pripravujeme“. |

---

## Funkcie podrobne

### Plán od AI trénera (režim Coach)
- Cieľ: schudnúť, zdravie, udržať formu, vytrvalosť, rýchlosť, celková kondícia. Pri cieľoch zdravie/chudnutie píše AI bez žargónu a nedáva tvrdé intervaly.
- Športy: user vyberie, ktoré robí (beh, bicykel, plávanie, posilňovanie…). Bez vytrvalostného športu je hlavný šport sila – AI ho nenahradí behom.
- Čas na tréning za týždeň, počet silových tréningov (aj 0 – vtedy žiadne), vybavenie (doma s vlastnou váhou, činky, posilňovňa).
- Preteky: dátum, vzdialenosť, prevýšenie, terén, cieľový čas. Plán sa k nim stavia a pred pretekmi ladí formu (tapering).
- Opakujúce sa aktivity mimo plánu (futbal, tanec…) a jednorazové udalosti (svadba, sťahovanie) – plán s nimi počíta.
- Plán sa prispôsobuje: únava, zlá regenerácia, choroba, zranenie, menštruácia, zmeškané tréningy.
- Každý naplánovaný tréning sa dá otvoriť a nechať si ho od AI trénera upraviť alebo vysvetliť.

### Hodnotenie tréningov
- AI tréner ohodnotí aktivitu (tempo, tep, úseky, terén – pomalší kilometer do kopca nie je únava). User pridá pocit po tréningu (1–5).
- **Uvítací týždeň:** v prvom týždni dostane nový user hodnotenie každej aktivity zo Stravy automaticky a zadarmo.
- Silový tréning sa hodnotí na požiadanie.

### Analýza športovca (každú nedeľu)
- Trénovanosť, únava, riziko zranenia, tolerancia objemu, odporúčaná fáza prípravy.
- Pri behu: odhad VO2max, tempá pre zóny, odhady časov na 5 km až maratón.
- Pri posilňovaní: úroveň sily, pravidelnosť, progres v hlavných cvikoch, objem po týždňoch – bez behu a temp.
- Porovnanie s minulou analýzou – čo sa zlepšilo, na čo si dať pozor.

### Silový tréning
- Zápis cvikov, sérií, váh a opakovaní; katalóg cvikov v SK/CS/EN, filtre podľa partií aj plyometria a izometria; chýbajúci cvik sa dá navrhnúť.
- Šablóny tréningov (vstavané aj vlastné, v kategóriách Moje / Beh / Sila / Chôdza / Ďalšie).
- Zápis k naplánovanému tréningu ho označí ako splnený – bez Stravy.
- Objem po svalových partiách (prsia, chrbát, ramená, nohy, stred tela…), stav voči cieľu týždňa.
- Progres cviku – graf váhy alebo opakovaní za pol roka.

### Regenerácia
- Ranný zápis: HRV, pokojový tep, spánok, alkohol, kofeín, neskoré jedlo, poznámka (alebo automaticky z intervals.icu).
- Pripravenosť na tréning, trendy HRV, tepu a spánku.
- AI rozlišuje „HRV dole po víne“ od „HRV dole tretí deň bez príčiny“.

### Zdravie
- Záznam choroby, zranenia, únavy alebo menštruácie (so závažnosťou). Plán sa prispôsobí (Coach), resp. AI tréner prehodnotí týždeň (Poradca).

### Výkon a telo
- VO2max, tepové zóny, tempá pre zóny, osobné rekordy v behu, odhad časov.
- Telesná váha, % tuku, telesné zloženie zo skenu (napr. InBody) s hodnotením od AI.

### Aktivity a motivácia
- Kalendár – naplánované, splnené, zmeškané, odložené tréningy aj ručné silové zápisy.
- Séria tréningov (koľko týždňov po sebe trénuješ) – ráta aj posilňovňu.
- Týždenná záťaž, pomer ľahkých a náročných tréningov (80/20), monotónnosť tréningov, porovnanie tej istej trasy v čase.
- Mesačné zhrnutie s AI hodnotením – aj zo silových zápisov (série, opakovania, najlepšie váhy).
- Wrapped – súhrn aktivít (po pretekoch, na konci roka).
- Zdieľanie tréningu ako obrázok (svetlá/tmavá téma).

### Ďalšie
- Widgety: user si vyberie, čo vidí, a Domov poskladá ako obľúbené.
- Notifikácie: dnešný tréning, nesplnený tréning, ranná regenerácia, mesačné zhrnutie, motivácia – dajú sa vypnúť po skupinách.
- Predplatné: základný program a vyššie programy s väčším množstvom AI kreditov (platby cez Stripe). **Ceny v obsahu neuvádzaj** – odkáž na appku.

---

## Značka a tón

- **Farby:** čierne pozadie, limetková **#A4F52B**, biela. Jemné zelené čiary/vlny pri spodku, zelená žiara.
- **Písmo:** Inter (tučné nadpisy, čisté texty).
- **Maskoti:** zelené smajlíky v čiernych tričkách s nápisom „selfrace“ – žena (zelený cop) a muž. Pózy: žena s jednoručkami, bežec v teréne, lezec na OCR stene, žena s mobilom (logo SelfRace), muž s palcom hore, dvojica. Sú doplnok, nie hlavná vec obrázka.
- **Tón:** tykanie, krátko, priamo, ľudsky, s humorom, bez korporátnych fráz. Pre bežných ľudí bez žargónu. AI vždy ako **„AI tréner“**, nie len „AI“.
- **Logo Stravy:** „Powered by Strava“ len tam, kde ide o Strava dáta. Nie sme partner ani súčasť Stravy.

---

## Čo netvrdiť

- Živý tréner je **pripravovaný**, nie hotový.
- Žiadne zdravotné ani liečebné sľuby („vylieči“, „garantovane schudneš“).
- Žiadne vymyslené čísla (počet userov, výsledky, recenzie, citáty userov).
- Žiadne ceny, zľavy ani akcie, ktoré nie sú potvrdené.
- Nie je priame prepojenie s Garminom/Apple Health – dáta idú cez Stravu (a regenerácia voliteľne cez intervals.icu).
- Neohovárať konkurenciu.
