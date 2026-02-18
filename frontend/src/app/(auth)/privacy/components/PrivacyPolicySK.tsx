"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function PrivacyPolicySK() {
  return (
    <div className="space-y-6 text-sm leading-relaxed" style={{ color: appColors.textMuted }}>
      <div>
        <p className="font-bold mb-1" style={{ color: appColors.textPrimary }}>Zásady ochrany osobných údajov – SelfRace</p>
        <p>Posledná aktualizácia: 29. Januára 2026</p>
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
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>3. Ako používame vaše údaje</h3>
        <p className="mb-2">Vaše údaje sú používané výlučne na:</p>
        <ul className="list-disc pl-5 space-y-1 mb-4">
          <li>Výpočet osobných tréningových metrík (napr. tréningová záťaž, rozloženie intenzity, týždenné trendy).</li>
          <li>Koreláciu údajov o aktivitách zo Stravy s voliteľnými údajmi o regenerácii zadanými používateľom (HRV, spánok, poznámky).</li>
          <li>Generovanie súkromných výkonnostných súhrnov a dlhodobých prehľadov.</li>
        </ul>
        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Princípy ochrany údajov:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Súkromie od základu:</strong> Vaše údaje sú viditeľné iba pre vás.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Žiadne zdieľanie:</strong> Údaje sa nikdy nezdieľajú s inými používateľmi.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Žiadny predaj:</strong> Vaše osobné údaje nepredávame, neprenajímame ani inak nemonetizujeme.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Prístup iba na čítanie:</strong> SelfRace nikdy neupravuje ani nezapisuje dáta späť do vášho Strava účtu.</li>
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
          <li><strong style={{ color: appColors.textPrimary }}>Odpojenie:</strong> Ak odpojíte svoj Strava účet, všetky údaje o aktivitách a vypočítané metriky sú okamžite a trvalo vymazané z našich serverov. Pre ochranu API zdrojov platí 24-hodinové obmedzenie (cooldown) pred opätovným pripojením.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Vymazanie účtu:</strong> Na základe žiadosti o zrušenie vášho účtu SelfRace sa všetky údaje okamžite vymažú. Nastavenia a predvoľby zostávajú uchované po dobu 7-dňovej ochrannej lehoty (pre prípad obnovenia účtu), po ktorej sa trvalo odstránia.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>6. Vaše práva (GDPR)</h3>
        <p className="mb-2">Ak sa nachádzate v EÚ, máte právo na:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Prístup k údajom, ktoré o vás uchovávame.</li>
          <li>Požiadať o opravu alebo vymazanie vašich údajov.</li>
          <li>Kedykoľvek odvolať súhlas odpojením účtu Strava.</li>
          <li>Požiadať o úplné vymazanie účtu („právo na zabudnutie“).</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>7. Služby Tretích strán</h3>
        <p className="mb-2">SelfRace sa spolieha na obmedzený okruh dôveryhodných poskytovateľov služieb:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Strava API</strong> – prístup k údajom o aktivitách na základe súhlasu používateľa.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Supabase</strong> – autentifikácia a bezpečné ukladanie údajov.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Poskytovatelia AI (Enterprise API)</strong> – slúži len na súkromné analýzy, bez možnosti trénovania modelov na užívateľských dátach.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>8. Kontakt</h3>
        <p>V prípade akýchkoľvek otázok ohľadom týchto Zásad ochrany osobných údajov nás prosím kontaktujte na adrese: <a href="mailto:selfrace.app@gmail.com" className="hover:underline" style={{ color: appColors.textPrimary }}>selfrace.app@gmail.com</a></p>
      </section>
    </div>
  );
}