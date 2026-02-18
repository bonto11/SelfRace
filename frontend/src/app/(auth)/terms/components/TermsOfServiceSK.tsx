"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function TermsOfServiceSK() {
  return (
    <div className="space-y-6 text-sm leading-relaxed" style={{ color: appColors.textMuted }}>
      <div>
        <p className="font-bold mb-1" style={{ color: appColors.textPrimary }}>Podmienky používania – SelfRace</p>
        <p>Posledná aktualizácia: 29. Januára 2026</p>
      </div>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>1. Súhlas s podmienkami</h3>
        <p>
          Vytvorením účtu a používaním aplikácie SelfRace súhlasíte s tým, že budete viazaní týmito Podmienkami používania. Ak s nimi nesúhlasíte, aplikáciu nepoužívajte.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>2. Žiadne lekárske ani profesionálne poradenstvo (Vyhlásenie o odmietnutí zodpovednosti)</h3>
        <p className="mb-2">SelfRace NIE JE zdravotnícka pomôcka, licencovaný poskytovateľ zdravotnej starostlivosti ani profesionálny tréner.</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Len na informačné účely:</strong> Všetky analýzy, prehľady a ukazovatele tréningovej záťaže poskytované aplikáciou SelfRace slúžia výlučne na informačné a vzdelávacie účely.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Poraďte sa s odborníkom:</strong> Pred začatím akéhokoľvek nového cvičebného programu by ste sa mali poradiť s lekárom alebo kvalifikovaným zdravotníckym pracovníkom, najmä ak máte nejaké predchádzajúce zdravotné problémy.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Počúvajte svoje telo:</strong> Automatizované prehľady nemôžu nahradiť váš osobný úsudok ani radu zdravotníckeho pracovníka. Nikdy neignorujte odborné lekárske rady ani neodkladajte ich vyhľadanie kvôli niečomu, čo ste si prečítali v tejto aplikácii.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>3. Prevzatie rizika a Zodpovednosť</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Zodpovednosť používateľa:</strong> Beriete na vedomie, že vytrvalostný tréning a cvičenie s vysokou intenzitou zahŕňajú inherentné riziká zranenia alebo smrti. Dobrovoľne na seba preberáte všetky známe aj neznáme riziká spojené s vaším tréningom.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Obmedzenie zodpovednosti:</strong> V maximálnom rozsahu povolenom zákonom, SelfRace a jej vývojári nenesú zodpovednosť za žiadne zranenia, zdravotné problémy, škody alebo straty (vrátane, ale nie výlučne fyzického zranenia, zástavy srdca alebo syndrómu pretrénovania) vyplývajúce z vášho používania aplikácie alebo spoliehania sa na jej údaje.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Presnosť údajov:</strong> Aj keď sa snažíme o presnosť, SelfRace závisí od údajov tretích strán (Strava) a vstupov používateľa. Nezaručujeme, že analýzy alebo prehľady generované umelou inteligenciou sú 100% presné alebo bezchybné.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>4. Správa dát a Odpojenie</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Zásady odpojenia:</strong> Ak sa rozhodnete odpojiť svoj účet Strava, SelfRace okamžite a natrvalo vymaže všetky historické údaje o aktivitách a analytické prehľady odvodené zo služby Strava z našej aktívnej databázy. Táto akcia je nezvratná.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Obmedzenie API (Cooldown):</strong> Na zabezpečenie stability služby a zamedzenie zneužívania API sa na používateľov, ktorí odpoja svoj účet Strava, vzťahuje 24-hodinová čakacia lehota pred opätovným pripojením.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Limity po opätovnom pripojení:</strong> Po opätovnom pripojení aplikácia vykoná čerstvú synchronizáciu nedávnej histórie (zvyčajne posledných 7 dní) na obnovenie tréningového panelu.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>5. Využívanie AI poznatkov</h3>
        <p>
          SelfRace využíva automatizovanú analýzu na poskytovanie spätnej väzby k tréningu. Tieto poznatky sú generované na základe historických metadát a nezohľadňujú aktuálne environmentálne faktory, skryté ochorenia ani psychický stres. Za interpretáciu a konanie na základe týchto poznatkov nesiete výhradnú zodpovednosť.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>6. Ukončenie služby</h3>
        <p>
          Vyhradzujeme si právo službu kedykoľvek upraviť alebo ukončiť. Váš účet môžete kedykoľvek odstrániť alebo sa odpojiť od služby Strava podľa vlastného uváženia. Zmazanie účtu zahŕňa 7-dňovú ochrannú lehotu pre nastavenia profilu, avšak dáta pochádzajúce zo Stravy sú na požiadanie vymazané okamžite.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>7. Rozhodné právo</h3>
        <p>
          Tieto podmienky sa riadia zákonmi Slovenskej republiky. Akékoľvek spory budú riešené príslušnými súdmi Slovenskej republiky.
        </p>
      </section>
    </div>
  );
}