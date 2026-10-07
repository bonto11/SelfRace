"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function TermsOfServiceCS() {
  return (
    <div className="space-y-6 text-sm leading-relaxed" style={{ color: appColors.textMuted }}>
      <div>
        <p className="font-bold mb-1" style={{ color: appColors.textPrimary }}>Podmínky používání – SelfRace</p>
        <p>Poslední aktualizace: 6. října 2026</p>
      </div>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>1. Souhlas s podmínkami</h3>
        <p>
          Vytvořením účtu a používáním aplikace SelfRace souhlasíte s těmito Podmínkami používání a se Zásadami ochrany osobních údajů. Pokud s nimi nesouhlasíte, aplikaci nepoužívejte.
        </p>
        <p className="mt-2">
          K používání SelfRace vám musí být alespoň 16 let. Odpovídáte za bezpečnost svých přihlašovacích údajů a za veškerou činnost ve svém účtu. Účet je osobní a nesmíte ho sdílet s jinými lidmi.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>2. Co je SelfRace</h3>
        <p className="mb-2">
          SelfRace je osobní tréninková aplikace pro vytrvalostní sportovce. Analyzuje vaše vlastní tréninková a regenerační data a pomocí AI pro vás připravuje tréninkové plány, doporučení a zpětnou vazbu.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Soukromí od základu:</strong> Vaše data i všechny výstupy AI vidíte pouze vy. SelfRace nemá sociální funkce, žebříčky ani srovnávání s jinými uživateli.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Režim trenér a poradce:</strong> V režimu trenér AI sestavuje a upravuje váš tréninkový plán. V režimu poradce si plán skládáte sami a AI ho jen hodnotí a radí – plán nikdy nemění.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>3. Žádné lékařské ani odborné poradenství</h3>
        <p className="mb-2">SelfRace NENÍ zdravotnický prostředek, poskytovatel zdravotní péče ani náhrada lékaře či fyzioterapeuta.</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Jen pro informační účely:</strong> Všechny analýzy, plány, přehledy a ukazatele tréninkové zátěže v aplikaci SelfRace slouží výhradně k informačním a vzdělávacím účelům.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Poraďte se s odborníkem:</strong> Před zahájením nového tréninkového programu se poraďte s lékařem nebo kvalifikovaným zdravotnickým pracovníkem, zejména pokud máte zdravotní problém, zranění nebo jste těhotná.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Zdravotní záznamy nejsou diagnóza:</strong> Když zapíšete zranění, nemoc nebo jiný zdravotní záznam, SelfRace mu jen přizpůsobí trénink. Nestanovuje diagnózu a nic neléčí.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Poslouchejte své tělo:</strong> Automatická doporučení nenahradí váš úsudek ani radu lékaře. Při bolesti, tlaku na hrudi, závrati či jiných varovných příznacích trénink přerušte a vyhledejte pomoc.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>4. Obsah vytvořený pomocí AI</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Jak to funguje:</strong> Plány, hodnocení a doporučení vytvářejí AI modely externích poskytovatelů výhradně z vašich vlastních dat (aktivity, regenerace, zdravotní záznamy a nastavení).
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Žádné trénování modelů:</strong> Vaše data, včetně dat ze Stravy a jiných propojených platforem, se nikdy nepoužívají k trénování AI modelů – našich ani poskytovatelů. Zpracovávají se jen k vytvoření výstupu pro vás.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>AI se může mýlit:</strong> Výstupy AI mohou být nepřesné nebo neúplné a nezohledňují věci, o kterých aplikace neví (např. počasí, skrytou nemoc, stres). Za to, jak je použijete, odpovídáte sami.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>5. Převzetí rizika a odpovědnost</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Odpovědnost uživatele:</strong> Berete na vědomí, že vytrvalostní trénink a cvičení s vysokou intenzitou s sebou nesou riziko zranění nebo smrti. Dobrovolně přebíráte všechna známá i neznámá rizika spojená s vaším tréninkem.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Omezení odpovědnosti:</strong> V maximálním rozsahu, který povoluje zákon, SelfRace ani jeho provozovatel neodpovídají za zranění, zdravotní problémy, škody nebo ztráty (mimo jiné fyzické zranění, srdeční příhody nebo přetrénování) vzniklé používáním aplikace nebo spoléháním se na její data. Tyto podmínky neomezují odpovědnost, kterou podle platného práva omezit nelze.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Přesnost dat:</strong> SelfRace závisí na datech třetích stran (např. Strava, intervals.icu, vaše hodinky) a na vašich vlastních záznamech. Negarantujeme, že analýzy ani výstupy AI jsou přesné a bez chyb.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>6. Strava a další propojené služby</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Váš souhlas:</strong> Strava, intervals.icu a (až bude dostupný) Garmin Connect se připojují jen na vaši výslovnou žádost a kdykoli je můžete odpojit. Na jejich používání se vztahují i jejich vlastní podmínky.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Jen čtení:</strong> SelfRace z propojených služeb data jen čte a do Stravy nikdy nic nezapisuje. Jedinou výjimkou je odeslání naplánovaného tréninku do hodinek, pokud to výslovně zapnete.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Data vidíte jen vy:</strong> Data ze Stravy a jiných platforem se zobrazují pouze vám, nikdy se nesdílejí s jinými uživateli a nikdy se neprodávají.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Odpojení Stravy:</strong> Pokud Stravu odpojíte, SelfRace okamžitě a natrvalo smaže všechna data o aktivitách a metriky odvozené ze Stravy. Tento krok nelze vrátit.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Opětovné připojení:</strong> Kvůli stabilitě služby platí před opětovným připojením Stravy 24hodinová přestávka. Po připojení SelfRace načte vaši nedávnou historii (zpravidla posledních 30 dní).
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Nezávislost:</strong> SelfRace je nezávislá aplikace. Není produktem společností Strava, Garmin ani intervals.icu a tyto společnosti ji nepodporují ani nesponzorují. Strava a Garmin jsou ochranné známky svých vlastníků.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>7. Pravidla používání</h3>
        <p className="mb-2">Zavazujete se, že nebudete:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>sdílet svůj účet ani používat aplikaci jménem jiné osoby bez jejího souhlasu,</li>
          <li>pokoušet se získat přístup k datům jiných uživatelů, obcházet zabezpečení nebo limity používání,</li>
          <li>kopírovat, automaticky stahovat (scraping), zpětně analyzovat ani dále prodávat aplikaci nebo její výstupy,</li>
          <li>používat aplikaci způsobem, který ji přetěžuje nebo porušuje platné právo.</li>
        </ul>
        <p className="mt-2">Účet, který tato pravidla porušuje, můžeme pozastavit nebo zrušit.</p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>8. Předplatné, platby a vrácení peněz</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Zkušební doba:</strong> Noví uživatelé dostanou 31denní bezplatnou zkušební verzi plánu Pro. Po jejím skončení se účet automaticky přepne na plán Free, pokud si nekoupíte placené předplatné. Po zkušební době vám nikdy nic automaticky nestrhneme.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Plány a ceny:</strong> SelfRace nabízí bezplatný plán Free a placené plány Classic a Pro. Aktuální ceny včetně DPH a obsah jednotlivých plánů vždy uvidíte v aplikaci před nákupem. Placené předplatné se obnovuje automaticky každý měsíc, dokud ho nezrušíte.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Limity používání AI:</strong> Každý plán má měsíční limit používání AI. Po jeho vyčerpání jsou AI funkce znovu dostupné od dalšího měsíce nebo po přechodu na vyšší plán.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Platby:</strong> Platby zpracovává společnost Stripe. SelfRace neukládá údaje o vaší platební kartě.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Zrušení:</strong> Předplatné můžete kdykoli zrušit v aplikaci. Zrušení nabude účinnosti na konci aktuálního fakturačního období; do té doby vám placené funkce zůstávají.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Odstoupení od smlouvy a vrácení peněz:</strong> Podle spotřebitelského práva EU (směrnice 2011/83/EU) můžete od svého prvního placeného předplatného odstoupit do 14 dní od nákupu bez udání důvodu, a to e-mailem na support@selfrace.com. Po uplynutí této lhůty se platby nevracejí, kromě případů, kdy to vyžaduje zákon.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Změna cen:</strong> Ceny předplatného můžeme změnit. Upozorníme vás e-mailem alespoň 30 dní předem a nová cena platí až od vašeho dalšího fakturačního období.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>9. Zrušení účtu a ukončení služby</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Zrušení účtu:</strong> Účet můžete kdykoli zrušit v aplikaci. Data ze Stravy se smažou okamžitě; zbytek účtu se natrvalo smaže po 7denní lhůtě, během níž ho ještě můžete obnovit.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Změny služby:</strong> Službu nebo její části můžeme upravit, pozastavit nebo ukončit. Pokud službu ukončíme, podle možnosti vás upozorníme předem a vrátíme poměrnou část již zaplaceného, nevyčerpaného období.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>10. Změny podmínek</h3>
        <p>
          Tyto podmínky můžeme aktualizovat. O podstatných změnách vás upozorníme v aplikaci nebo e-mailem ještě před jejich účinností. Pokud budete SelfRace používat i po účinnosti změn, souhlasíte s aktualizovanými podmínkami.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>11. Rozhodné právo</h3>
        <p>
          Tyto podmínky se řídí právem Slovenské republiky. Případné spory rozhodují příslušné soudy Slovenské republiky. Tím nejsou dotčena závazná práva na ochranu spotřebitele v zemi, kde žijete.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>12. Kontakt</h3>
        <p>S dotazy k těmto podmínkám se obraťte na: <a href="mailto:support@selfrace.com" className="hover:underline" style={{ color: appColors.textPrimary }}>support@selfrace.com</a></p>
      </section>
    </div>
  );
}
