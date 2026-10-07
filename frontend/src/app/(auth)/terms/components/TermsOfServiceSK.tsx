"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function TermsOfServiceSK() {
  return (
    <div className="space-y-6 text-sm leading-relaxed" style={{ color: appColors.textMuted }}>
      <div>
        <p className="font-bold mb-1" style={{ color: appColors.textPrimary }}>Podmienky používania – SelfRace</p>
        <p>Posledná aktualizácia: 6. októbra 2026</p>
      </div>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>1. Súhlas s podmienkami</h3>
        <p>
          Vytvorením účtu a používaním aplikácie SelfRace súhlasíte s týmito Podmienkami používania a so Zásadami ochrany osobných údajov. Ak s nimi nesúhlasíte, aplikáciu nepoužívajte.
        </p>
        <p className="mt-2">
          Na používanie SelfRace musíte mať aspoň 16 rokov. Zodpovedáte za bezpečnosť svojich prihlasovacích údajov a za všetku činnosť vo svojom účte. Účet je osobný a nesmiete ho zdieľať s inými ľuďmi.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>2. Čo je SelfRace</h3>
        <p className="mb-2">
          SelfRace je osobná tréningová aplikácia pre vytrvalostných športovcov. Analyzuje vaše vlastné tréningové a regeneračné dáta a pomocou AI pre vás pripravuje tréningové plány, odporúčania a spätnú väzbu.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Súkromie od základu:</strong> Vaše dáta aj všetky výstupy AI vidíte iba vy. SelfRace nemá sociálne funkcie, rebríčky ani porovnávanie s inými používateľmi.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Režim tréner a poradca:</strong> V režime tréner AI zostavuje a upravuje váš tréningový plán. V režime poradca si plán skladáte sami a AI ho len hodnotí a radí – plán nikdy nemení.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>3. Žiadne lekárske ani odborné poradenstvo</h3>
        <p className="mb-2">SelfRace NIE JE zdravotnícka pomôcka, poskytovateľ zdravotnej starostlivosti ani náhrada lekára či fyzioterapeuta.</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Len na informačné účely:</strong> Všetky analýzy, plány, prehľady a ukazovatele tréningovej záťaže v aplikácii SelfRace slúžia výlučne na informačné a vzdelávacie účely.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Poraďte sa s odborníkom:</strong> Pred začatím nového tréningového programu sa poraďte s lekárom alebo kvalifikovaným zdravotníckym pracovníkom, najmä ak máte zdravotný problém, zranenie alebo ste tehotná.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Zdravotné záznamy nie sú diagnóza:</strong> Keď zapíšete zranenie, chorobu alebo iný zdravotný záznam, SelfRace mu len prispôsobí tréning. Nestanovuje diagnózu a nič nelieči.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Počúvajte svoje telo:</strong> Automatické odporúčania nenahradia váš úsudok ani radu lekára. Pri bolesti, tlaku na hrudi, závrate či iných varovných príznakoch tréning prerušte a vyhľadajte pomoc.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>4. Obsah vytvorený pomocou AI</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Ako to funguje:</strong> Plány, hodnotenia a odporúčania vytvárajú AI modely externých poskytovateľov výlučne z vašich vlastných dát (aktivity, regenerácia, zdravotné záznamy a nastavenia).
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Žiadne trénovanie modelov:</strong> Vaše dáta, vrátane dát zo Stravy a iných prepojených platforiem, sa nikdy nepoužívajú na trénovanie AI modelov – našich ani poskytovateľov. Spracúvajú sa len na vytvorenie výstupu pre vás.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>AI sa môže mýliť:</strong> Výstupy AI môžu byť nepresné alebo neúplné a nezohľadňujú veci, o ktorých aplikácia nevie (napr. počasie, skrytú chorobu, stres). Za to, ako ich použijete, zodpovedáte sami.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>5. Prevzatie rizika a zodpovednosť</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Zodpovednosť používateľa:</strong> Beriete na vedomie, že vytrvalostný tréning a cvičenie s vysokou intenzitou so sebou nesú riziko zranenia alebo smrti. Dobrovoľne preberáte všetky známe aj neznáme riziká spojené s vaším tréningom.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Obmedzenie zodpovednosti:</strong> V maximálnom rozsahu, ktorý povoľuje zákon, SelfRace ani jeho prevádzkovateľ nezodpovedajú za zranenia, zdravotné problémy, škody alebo straty (okrem iného fyzické zranenie, srdcové príhody alebo pretrénovanie) vzniknuté používaním aplikácie alebo spoliehaním sa na jej dáta. Tieto podmienky neobmedzujú zodpovednosť, ktorú podľa platného práva obmedziť nemožno.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Presnosť dát:</strong> SelfRace závisí od dát tretích strán (napr. Strava, intervals.icu, vaše hodinky) a od vašich vlastných zápisov. Negarantujeme, že analýzy ani výstupy AI sú presné a bez chýb.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>6. Strava a ďalšie prepojené služby</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Váš súhlas:</strong> Strava, intervals.icu a (keď bude dostupný) Garmin Connect sa pripájajú len na vašu výslovnú žiadosť a kedykoľvek ich môžete odpojiť. Na ich používanie sa vzťahujú aj ich vlastné podmienky.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Len čítanie:</strong> SelfRace z prepojených služieb dáta len číta a do Stravy nikdy nič nezapisuje. Jedinou výnimkou je odoslanie naplánovaného tréningu do hodiniek, ak to výslovne zapnete.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Dáta vidíte len vy:</strong> Dáta zo Stravy a iných platforiem sa zobrazujú iba vám, nikdy sa nezdieľajú s inými používateľmi a nikdy sa nepredávajú.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Odpojenie Stravy:</strong> Ak Stravu odpojíte, SelfRace okamžite a natrvalo vymaže všetky dáta o aktivitách a metriky odvodené zo Stravy. Tento krok sa nedá vrátiť.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Opätovné pripojenie:</strong> Kvôli stabilite služby platí pred opätovným pripojením Stravy 24-hodinová prestávka. Po pripojení SelfRace načíta vašu nedávnu históriu (spravidla posledných 30 dní).
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Nezávislosť:</strong> SelfRace je nezávislá aplikácia. Nie je produktom spoločností Strava, Garmin ani intervals.icu a tieto spoločnosti ju nepodporujú ani nesponzorujú. Strava a Garmin sú ochranné známky svojich vlastníkov.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>7. Pravidlá používania</h3>
        <p className="mb-2">Zaväzujete sa, že nebudete:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>zdieľať svoj účet ani používať aplikáciu v mene inej osoby bez jej súhlasu,</li>
          <li>pokúšať sa získať prístup k dátam iných používateľov, obchádzať zabezpečenie alebo limity používania,</li>
          <li>kopírovať, automaticky sťahovať (scraping), spätne analyzovať ani ďalej predávať aplikáciu alebo jej výstupy,</li>
          <li>používať aplikáciu spôsobom, ktorý ju preťažuje alebo porušuje platné právo.</li>
        </ul>
        <p className="mt-2">Účet, ktorý tieto pravidlá porušuje, môžeme pozastaviť alebo zrušiť.</p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>8. Predplatné, platby a vrátenie peňazí</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Skúšobná doba:</strong> Noví používatelia dostanú 31-dňovú bezplatnú skúšobnú verziu plánu Pro. Po jej skončení sa účet automaticky prepne na plán Free, ak si nekúpite platené predplatné. Po skúšobnej dobe vám nikdy nič automaticky nestrhneme.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Plány a ceny:</strong> SelfRace ponúka bezplatný plán Free a platené plány Classic a Pro. Aktuálne ceny vrátane DPH a obsah jednotlivých plánov vždy uvidíte v aplikácii pred kúpou. Platené predplatné sa obnovuje automaticky každý mesiac, kým ho nezrušíte.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Limity používania AI:</strong> Každý plán má mesačný limit používania AI. Po jeho vyčerpaní sú AI funkcie znova dostupné od ďalšieho mesiaca alebo po prechode na vyšší plán.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Platby:</strong> Platby spracúva spoločnosť Stripe. SelfRace neukladá údaje o vašej platobnej karte.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Zrušenie:</strong> Predplatné môžete kedykoľvek zrušiť v aplikácii. Zrušenie nadobudne účinnosť na konci aktuálneho fakturačného obdobia; dovtedy vám platené funkcie ostávajú.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Odstúpenie od zmluvy a vrátenie peňazí:</strong> Podľa spotrebiteľského práva EÚ (smernica 2011/83/EÚ) môžete od svojho prvého plateného predplatného odstúpiť do 14 dní od kúpy bez udania dôvodu, a to e-mailom na support@selfrace.com. Po uplynutí tejto lehoty sa platby nevracajú, okrem prípadov, keď to vyžaduje zákon.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Zmena cien:</strong> Ceny predplatného môžeme zmeniť. Upozorníme vás e-mailom aspoň 30 dní vopred a nová cena platí až od vášho ďalšieho fakturačného obdobia.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>9. Zrušenie účtu a ukončenie služby</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Zrušenie účtu:</strong> Účet môžete kedykoľvek zrušiť v aplikácii. Dáta zo Stravy sa vymažú okamžite; zvyšok účtu sa natrvalo vymaže po 7-dňovej lehote, počas ktorej ho ešte môžete obnoviť.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Zmeny služby:</strong> Službu alebo jej časti môžeme upraviť, pozastaviť alebo ukončiť. Ak službu ukončíme, podľa možnosti vás upozorníme vopred a vrátime pomernú časť už zaplateného, nevyčerpaného obdobia.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>10. Zmeny podmienok</h3>
        <p>
          Tieto podmienky môžeme aktualizovať. O podstatných zmenách vás upozorníme v aplikácii alebo e-mailom ešte pred ich účinnosťou. Ak budete SelfRace používať aj po účinnosti zmien, súhlasíte s aktualizovanými podmienkami.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>11. Rozhodné právo</h3>
        <p>
          Tieto podmienky sa riadia právom Slovenskej republiky. Prípadné spory rozhodujú príslušné súdy Slovenskej republiky. Tým nie sú dotknuté záväzné práva na ochranu spotrebiteľa v krajine, kde žijete.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>12. Kontakt</h3>
        <p>S otázkami k týmto podmienkam sa obráťte na: <a href="mailto:support@selfrace.com" className="hover:underline" style={{ color: appColors.textPrimary }}>support@selfrace.com</a></p>
      </section>
    </div>
  );
}
