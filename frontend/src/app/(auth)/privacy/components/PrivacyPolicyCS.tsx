"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function PrivacyPolicyCS() {
  return (
    <div className="space-y-6 text-sm leading-relaxed" style={{ color: appColors.textMuted }}>
      <div>
        <p className="font-bold mb-1" style={{ color: appColors.textPrimary }}>Zásady ochrany osobních údajů – SelfRace</p>
        <p>Poslední aktualizace: 6. října 2026</p>
      </div>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>1. Přehled</h3>
        <p>
          SelfRace je osobní analytická aplikace navržená pro vytrvalostní sportovce k analýze jejich vlastních tréninkových dat a dlouhodobých výkonnostních trendů. Respektujeme soukromí uživatelů a osobní údaje zpracováváme výhradně za účelem poskytování analytických funkcí a funkcí koučinku, které si uživatel vyžádal.
        </p>
        <p className="mt-2 font-medium">
          SelfRace je soukromý nástroj pro sebehodnocení. Neobsahuje žádné sociální funkce, žebříčky ani srovnávání s jinými sportovci.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>2. Data, která shromažďujeme, a právní základ</h3>
        <p className="mb-2">
          Připojením svého účtu Strava dáváte aplikaci SelfRace výslovný souhlas k přístupu a zpracování následujících údajů výhradně pro účely tréninkové analýzy:
        </p>
        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Údaje získávané ze služby Strava:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Metriky aktivit:</strong> Vzdálenost, trvání, typ sportu, tempo, převýšení, kadence, výkon, metriky úsilí a časová razítka.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Fyziologické a výkonnostní metriky:</strong> Srdeční frekvence a odvozené ukazatele zatížení používané výhradně k analýze výkonu a regenerace.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Identifikátory účtu:</strong> Strava ID sportovce a e-mailová adresa (používané výhradně k autentizaci a správě účtu přes platformu Supabase).</li>
        </ul>
        <p className="font-semibold mt-4 mb-1" style={{ color: appColors.textSecondary }}>Údaje, které NEPOUŽÍVÁME:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Neukládáme ani nezobrazujeme přesné GPS trasy ani mapy polohy.</li>
          <li>Nezpracováváme sociální údaje (sledující, kluby, komentáře).</li>
          <li>Nemáme přístup k soukromým zprávám ani jinému obsahu, který nesouvisí s tréninkem.</li>
        </ul>

        <p className="font-semibold mt-4 mb-1" style={{ color: appColors.textSecondary }}>Údaje z připojených platforem a hodinek (volitelné):</p>
        <p className="mb-2">Tyto služby se připojují jen na váš výslovný pokyn a můžete je kdykoli odpojit.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>intervals.icu:</strong> Denní údaje o regeneraci – HRV (noční průměr), klidová srdeční frekvence a délka spánku. Přístup přes API klíč, který nám poskytnete.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Garmin Connect (po spuštění integrace):</strong> Aktivity, spánek, HRV a klidová srdeční frekvence na základě vašeho souhlasu přes Garmin (OAuth). Pokud si to zapnete, naplánované tréninky můžeme odeslat do vašich hodinek.</li>
        </ul>

        <p className="font-semibold mt-4 mb-1" style={{ color: appColors.textSecondary }}>Údaje, které zadáváte sami:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Regenerace:</strong> HRV, klidová srdeční frekvence, spánek, faktory (alkohol, kofein, pozdní jídlo) a poznámky.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Zdravotní záznamy:</strong> Zranění, nemoc, únava a menstruace – aby se trénink přizpůsobil vašemu stavu.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Složení těla:</strong> Údaje z body scanu (např. InBody), které nahrajete nebo zadáte.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Profil a preference:</strong> Cíle, závody, dostupný čas a vybavení, tréninková nastavení.</li>
        </ul>

        <p className="font-semibold mt-4 mb-1" style={{ color: appColors.textSecondary }}>Údaje o zdraví (zvláštní kategorie podle čl. 9 GDPR):</p>
        <p>
          HRV, srdeční frekvence, spánek, zdravotní záznamy a složení těla jsou údaje o zdraví. Zpracováváme je jen na základě vašeho výslovného souhlasu, který dáváte jejich zadáním nebo připojením služby, a jen k přizpůsobení vašeho tréninku a hodnocení. Souhlas můžete kdykoli odvolat odpojením služby nebo smazáním údajů či účtu.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>3. Jak používáme vaše údaje</h3>
        <p className="mb-2">Vaše údaje se používají výhradně k:</p>
        <ul className="list-disc pl-5 space-y-1 mb-4">
          <li>Výpočtu osobních tréninkových metrik (např. tréninková zátěž, rozložení intenzity, týdenní trendy).</li>
          <li>Propojení údajů o aktivitách s údaji o regeneraci a zdraví – zadanými ručně nebo načtenými z připojených platforem (HRV, spánek, klidová srdeční frekvence, poznámky).</li>
          <li>Přizpůsobení tréninkového plánu a doporučení vašemu aktuálnímu stavu.</li>
          <li>Generování soukromých výkonnostních souhrnů a dlouhodobých přehledů.</li>
        </ul>
        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Principy ochrany údajů:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Soukromí od základu:</strong> Vaše údaje jsou viditelné pouze pro vás.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Žádné sdílení:</strong> Údaje se nikdy nesdílejí s jinými uživateli.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Žádný prodej:</strong> Vaše osobní údaje neprodáváme, nepronajímáme ani jinak nemonetizujeme.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Přístup pouze pro čtení:</strong> SelfRace nikdy neupravuje ani nezapisuje data zpět do vašeho účtu Strava ani do připojených platforem. Jedinou výjimkou je odeslání naplánovaného tréninku do hodinek, pokud si ho výslovně zapnete.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>4. Umělá inteligence a automatizované zpracování</h3>
        <p className="mb-2">SelfRace využívá automatizovanou analýzu (logika podporovaná AI prostřednictvím privátních API rozhraní) ke generování tréninkových přehledů.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Zpracování zaměřené na uživatele:</strong> AI se používá pouze k interpretaci vlastních statistik uživatele pro jeho soukromý panel.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Žádné trénování modelů:</strong> Uživatelská data se nepoužívají k trénování globálních modelů strojového učení. Využíváme výhradně profesionální (enterprise-grade) úrovně API.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Minimální uchovávání:</strong> Údaje odeslané k AI analýze se zpracují pouze v reálném čase a po skončení zpracování je poskytovatel AI neuchovává.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>5. Ukládání a uchovávání dat</h3>
        <p className="mb-2">Uplatňujeme strategii minimalizace dat, abychom zajistili soulad s podmínkami platformy Strava.</p>

        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Detailní data o aktivitách (sekundy, úseky, mezičasy):</p>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>Detailní údaje o aktivitě jsou dočasně uloženy v mezipaměti pro podporu hloubkové analýzy.</li>
          <li>Doba uchování: Automaticky smazány po sedmi (7) dnech.</li>
        </ul>

        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Souhrny aktivit a trendy:</p>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>Základní metadata o aktivitách (souhrny – datum, sport, trvání, vzdálenost, tep) se uchovávají, dokud máte připojenou Stravu a aktivní účet. Slouží k dlouhodobým trendům (např. CTL/ATL, série tréninků, měsíční přehledy). Při prvním připojení načteme nejvýše posledních 12 měsíců.</li>
          <li>Agregované přehledy (např. týdenní součty) jsou uloženy ve formě, kterou nelze zpětně dekódovat do podoby jednotlivých podrobných aktivit.</li>
        </ul>

        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Odpojení a smazání účtu:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Údaje o regeneraci a zdraví:</strong> Uchováváme je, dokud máte účet, aby bylo možné sledovat dlouhodobé trendy (např. baseline HRV). Na požádání je smažeme dříve.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Odpojení intervals.icu / Garmin:</strong> Okamžitě se zastaví další načítání a smaže se uložený přístup (API klíč nebo token). Již načtené hodnoty regenerace zůstávají součástí vašeho záznamu, dokud nepožádáte o jejich smazání.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Odpojení Stravy:</strong> Pokud odpojíte svůj účet Strava, všechny údaje o aktivitách a vypočtené metriky jsou okamžitě a trvale smazány z našich serverů. Kvůli ochraně API zdrojů platí 24hodinové omezení (cooldown) před opětovným připojením.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Smazání účtu:</strong> Na základě žádosti o zrušení vašeho účtu SelfRace se všechny údaje okamžitě smažou. Nastavení a předvolby zůstávají uchovány po dobu 7denní ochranné lhůty (pro případ obnovení účtu), po jejímž uplynutí se trvale odstraní.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>6. Vaše práva (GDPR)</h3>
        <p className="mb-2">Pokud se nacházíte v EU, máte právo na:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Přístup k údajům, které o vás uchováváme.</li>
          <li>Požádat o opravu nebo smazání vašich údajů.</li>
          <li>Kdykoli odvolat souhlas odpojením účtu Strava nebo jiné připojené služby.</li>
          <li>Přenositelnost údajů – získat své údaje ve strukturovaném formátu.</li>
          <li>Požádat o úplné smazání účtu („právo být zapomenut“).</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>7. Služby třetích stran</h3>
        <p className="mb-2">SelfRace se spoléhá na omezený okruh důvěryhodných poskytovatelů služeb:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Strava API</strong> – přístup k údajům o aktivitách na základě souhlasu uživatele.</li>
          <li><strong style={{ color: appColors.textPrimary }}>intervals.icu</strong> – načítání údajů o regeneraci z hodinek na základě vašeho souhlasu.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Garmin Connect</strong> (po spuštění integrace) – aktivity a údaje o regeneraci na základě vašeho souhlasu.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Supabase</strong> – autentizace a bezpečné ukládání údajů (databáze s řízením přístupu na úrovni řádků).</li>
          <li><strong style={{ color: appColors.textPrimary }}>Poskytovatelé AI (Enterprise API – Anthropic, Google, OpenAI)</strong> – slouží jen k soukromým analýzám, bez možnosti trénování modelů na uživatelských datech.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Stripe</strong> – zpracování plateb za předplatné. Údaje o platební kartě neukládáme.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Vercel, Railway</strong> – hosting webové aplikace a serveru.</li>
        </ul>
        <p className="mt-2">
          Tito poskytovatelé zpracovávají údaje jen naším jménem a k uvedenému účelu. Údaje neprodáváme ani neposkytujeme třetím stranám pro jejich vlastní účely.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>8. Kontakt</h3>
        <p>V případě jakýchkoli dotazů ohledně těchto Zásad ochrany osobních údajů nás prosím kontaktujte na adrese: <a href="mailto:support@selfrace.com" className="hover:underline" style={{ color: appColors.textPrimary }}>support@selfrace.com</a></p>
      </section>
    </div>
  );
}
