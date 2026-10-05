"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function PrivacyPolicySK() {
  return (
    <div className="space-y-6 text-sm leading-relaxed" style={{ color: appColors.textMuted }}>
      <div>
        <p className="font-bold mb-1" style={{ color: appColors.textPrimary }}>Zásady ochrany osobných údajov – SelfRace</p>
        <p>Posledná aktualizácia: 5. októbra 2026</p>
      </div>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>1. Prehľad</h3>
        <p>
          SelfRace je osobná analytická aplikácia navrhnutá pre vytrvalostných športovcov na analýzu ich vlastných tréningových dát a dlhodobých výkonnostných trendov. Rešpektujeme súkromie používateľov a osobné údaje spracovávame výlučne za účelom poskytovania analytických funkcií a funkcií koučingu, ktoré si používateľ vyžiadal.
        </p>
        <p className="mt-2 font-medium">
          SelfRace je súkromný nástroj na sebahodnotenie. Neobsahuje žiadne sociálne funkcie, rebríčky ani porovnávania s inými športovcami.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>2. Dáta, ktoré zbierame a Právny základ</h3>
        <p className="mb-2">
          Pripojením vášho účtu Strava poskytujete výslovný súhlas aplikácii SelfRace na prístup a spracovanie nasledujúcich údajov výlučne pre účely tréningovej analýzy:
        </p>
        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Údaje získavané zo služby Strava:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Metriky aktivít:</strong> Vzdialenosť, trvanie, typ športu, tempo, prevýšenie, kadencia, výkon, metriky úsilia a časové pečiatky.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Fyziologické a výkonnostné metriky:</strong> Srdcová frekvencia a odvodené ukazovatele zaťaženia používané výlučne na analýzu výkonu a regenerácie.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Identifikátory účtu:</strong> Strava ID športovca a e-mailová adresa (používané výhradne na autentifikáciu a správu účtu cez platformu Supabase).</li>
        </ul>
        <p className="font-semibold mt-4 mb-1" style={{ color: appColors.textSecondary }}>Údaje, ktoré NEPOUŽÍVAME:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Neukladáme ani nezobrazujeme presné GPS trasy ani mapy polohy.</li>
          <li>Nespracovávame sociálne údaje (sledovatelia, kluby, komentáre).</li>
          <li>Nemáme prístup k súkromným správam ani inému obsahu, ktorý nesúvisí s tréningom.</li>
        </ul>

        <p className="font-semibold mt-4 mb-1" style={{ color: appColors.textSecondary }}>Údaje z pripojených platforiem a hodiniek (voliteľné):</p>
        <p className="mb-2">Tieto služby sa pripájajú len na váš výslovný pokyn a môžete ich kedykoľvek odpojiť.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>intervals.icu:</strong> Denné údaje o regenerácii – HRV (nočný priemer), pokojová srdcová frekvencia a dĺžka spánku. Prístup cez API kľúč, ktorý nám poskytnete.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Garmin Connect (po spustení integrácie):</strong> Aktivity, spánok, HRV a pokojová srdcová frekvencia na základe vášho súhlasu cez Garmin (OAuth). Ak si to zapnete, naplánované tréningy môžeme odoslať do vašich hodiniek.</li>
        </ul>

        <p className="font-semibold mt-4 mb-1" style={{ color: appColors.textSecondary }}>Údaje, ktoré zadávate sami:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Regenerácia:</strong> HRV, pokojová srdcová frekvencia, spánok, faktory (alkohol, kofeín, neskoré jedlo) a poznámky.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Zdravotné záznamy:</strong> Zranenie, choroba, únava a menštruácia – aby sa tréning prispôsobil vášmu stavu.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Zloženie tela:</strong> Údaje z body scanu (napr. InBody), ktoré nahráte alebo zadáte.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Profil a preferencie:</strong> Ciele, preteky, dostupný čas a vybavenie, tréningové nastavenia.</li>
        </ul>

        <p className="font-semibold mt-4 mb-1" style={{ color: appColors.textSecondary }}>Údaje o zdraví (osobitná kategória podľa čl. 9 GDPR):</p>
        <p>
          HRV, srdcová frekvencia, spánok, zdravotné záznamy a zloženie tela sú údaje o zdraví. Spracúvame ich len na základe vášho výslovného súhlasu, ktorý dávate ich zadaním alebo pripojením služby, a len na prispôsobenie vášho tréningu a hodnotení. Súhlas môžete kedykoľvek odvolať odpojením služby alebo vymazaním údajov či účtu.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>3. Ako používame vaše údaje</h3>
        <p className="mb-2">Vaše údaje sú používané výlučne na:</p>
        <ul className="list-disc pl-5 space-y-1 mb-4">
          <li>Výpočet osobných tréningových metrík (napr. tréningová záťaž, rozloženie intenzity, týždenné trendy).</li>
          <li>Koreláciu údajov o aktivitách s údajmi o regenerácii a zdraví – zadanými ručne alebo načítanými z pripojených platforiem (HRV, spánok, pokojová srdcová frekvencia, poznámky).</li>
          <li>Prispôsobenie tréningového plánu a odporúčaní vášmu aktuálnemu stavu.</li>
          <li>Generovanie súkromných výkonnostných súhrnov a dlhodobých prehľadov.</li>
        </ul>
        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Princípy ochrany údajov:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Súkromie od základu:</strong> Vaše údaje sú viditeľné iba pre vás.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Žiadne zdieľanie:</strong> Údaje sa nikdy nezdieľajú s inými používateľmi.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Žiadny predaj:</strong> Vaše osobné údaje nepredávame, neprenajímame ani inak nemonetizujeme.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Prístup iba na čítanie:</strong> SelfRace nikdy neupravuje ani nezapisuje dáta späť do vášho Strava účtu ani do pripojených platforiem. Jedinou výnimkou je odoslanie naplánovaného tréningu do hodiniek, ak si ho výslovne zapnete.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>4. Umelá inteligencia a Automatizované spracovanie</h3>
        <p className="mb-2">SelfRace využíva automatizovanú analýzu (logika podporovaná AI prostredníctvom privátnych API rozhraní) na generovanie tréningových prehľadov.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Spracovanie zamerané na používateľa:</strong> AI sa používa iba na interpretáciu vlastných štatistík používateľa pre jeho súkromný panel.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Žiadne trénovanie modelov:</strong> Používateľské dáta sa nepoužívajú na trénovanie globálnych modelov strojového učenia. Využívame výlučne profesionálne (enterprise-grade) API úrovne.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Minimálne uchovávanie:</strong> Údaje odoslané na AI analýzu sú spracované iba v reálnom čase a po ukončení spracovania nie sú poskytovateľom AI uchovávané.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>5. Ukladanie a Uchovávanie dát</h3>
        <p className="mb-2">Uplatňujeme stratégiu minimalizácie dát, aby sme zabezpečili súlad s podmienkami platformy Strava.</p>
        
        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Detailné dáta o aktivitách (Sekundy, Úseky, Medzičasy):</p>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>Detailné údaje o aktivite sú dočasne uložené v medzipamäti pre podporu hĺbkovej analýzy.</li>
          <li>Doba uchovania: Automaticky vymazané po siedmich (7) dňoch.</li>
        </ul>

        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Súhrny aktivít a Trendy:</p>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>Základné metadáta o aktivitách (súhrny) sa uchovávajú až 90 dní na podporu výpočtov dlhodobých výkonnostných trendov (napr. CTL/ATL).</li>
          <li>Agregované prehľady (napr. týždenné súčty) sú uložené vo forme, ktorú nie je možné spätne dekódovať do podoby jednotlivých podrobných aktivít.</li>
        </ul>

        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Odpojenie a Vymazanie účtu:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Údaje o regenerácii a zdraví:</strong> Uchovávame ich, kým máte účet, aby bolo možné sledovať dlhodobé trendy (napr. baseline HRV). Na požiadanie ich vymažeme skôr.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Odpojenie intervals.icu / Garmin:</strong> Okamžite sa zastaví ďalšie načítavanie a vymaže sa uložený prístup (API kľúč alebo token). Už načítané hodnoty regenerácie ostávajú súčasťou vášho záznamu, kým nepožiadate o ich vymazanie.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Odpojenie Stravy:</strong> Ak odpojíte svoj Strava účet, všetky údaje o aktivitách a vypočítané metriky sú okamžite a trvalo vymazané z našich serverov. Pre ochranu API zdrojov platí 24-hodinové obmedzenie (cooldown) pred opätovným pripojením.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Vymazanie účtu:</strong> Na základe žiadosti o zrušenie vášho účtu SelfRace sa všetky údaje okamžite vymažú. Nastavenia a predvoľby zostávajú uchované po dobu 7-dňovej ochrannej lehoty (pre prípad obnovenia účtu), po ktorej sa trvalo odstránia.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>6. Vaše práva (GDPR)</h3>
        <p className="mb-2">Ak sa nachádzate v EÚ, máte právo na:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Prístup k údajom, ktoré o vás uchovávame.</li>
          <li>Požiadať o opravu alebo vymazanie vašich údajov.</li>
          <li>Kedykoľvek odvolať súhlas odpojením účtu Strava alebo inej pripojenej služby.</li>
          <li>Prenosnosť údajov – získať svoje údaje v štruktúrovanom formáte.</li>
          <li>Požiadať o úplné vymazanie účtu („právo na zabudnutie“).</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>7. Služby Tretích strán</h3>
        <p className="mb-2">SelfRace sa spolieha na obmedzený okruh dôveryhodných poskytovateľov služieb:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Strava API</strong> – prístup k údajom o aktivitách na základe súhlasu používateľa.</li>
          <li><strong style={{ color: appColors.textPrimary }}>intervals.icu</strong> – načítanie údajov o regenerácii z hodiniek na základe vášho súhlasu.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Garmin Connect</strong> (po spustení integrácie) – aktivity a údaje o regenerácii na základe vášho súhlasu.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Supabase</strong> – autentifikácia a bezpečné ukladanie údajov (databáza s riadením prístupu na úrovni riadkov).</li>
          <li><strong style={{ color: appColors.textPrimary }}>Poskytovatelia AI (Enterprise API – Anthropic, Google, OpenAI)</strong> – slúži len na súkromné analýzy, bez možnosti trénovania modelov na užívateľských dátach.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Stripe</strong> – spracovanie platieb za predplatné. Údaje o platobnej karte neukladáme.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Vercel, Railway</strong> – hosting webovej aplikácie a servera.</li>
        </ul>
        <p className="mt-2">
          Títo poskytovatelia spracúvajú údaje len v našom mene a na uvedený účel. Údaje nepredávame ani neposkytujeme tretím stranám na ich vlastné účely.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>8. Kontakt</h3>
        <p>V prípade akýchkoľvek otázok ohľadom týchto Zásad ochrany osobných údajov nás prosím kontaktujte na adrese: <a href="mailto:support@selfrace.com" className="hover:underline" style={{ color: appColors.textPrimary }}>support@selfrace.com</a></p>
      </section>
    </div>
  );
}