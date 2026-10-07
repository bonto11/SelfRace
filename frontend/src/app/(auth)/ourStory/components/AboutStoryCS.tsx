"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import AuthorSignature from "./AuthorSignature";

export default function AboutStoryCS() {
  return (
    <div className="space-y-8 text-sm leading-relaxed" style={{ color: appColors.textMuted }}>
      
      {/* Hlavní nadpis */}
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: appColors.textPrimary }}>Příběh Selfrace: Od sportovce, pro sportovce</h2>
      </div>

      {/* Sekce 1 */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold" style={{ color: appColors.textPrimary }}>Proč to celé vzniklo?</h3>
        <p>
          Budu k vám upřímný – Selfrace nevznikla v zasedačce marketingové agentury. Vznikla venku při longrunech a během nespočtu hodin hledání nástroje, který by mi skutečně vyhovoval. Všude mi něco chybělo. Někde to bylo příliš komplikované, jinde až příliš povrchní a většina věcí nereagovala na můj reálný stav.
        </p>
        <p>
          Tak jsem začal programovat po nocích. Nejdřív jen pro sebe. Chtěl jsem aplikaci, kterou budu sám s radostí otevírat každé ráno. A přesně to dělám – Selfrace používám naplno každý den.
        </p>
      </section>

      {/* Sekce 2 */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold" style={{ color: appColors.textPrimary }}>Víc než jen běh</h3>
        <p>
          Mojí vášní je běh, i když možná nemám ty nejlepší atletické předpoklady. Možná právě proto mě to tak baví – vidím ten obrovský prostor ke zlepšení. Ale vím, že běžec není jen o nohách. Selfrace stojí na rovnováze. Zapojil jsem do ní silovou část a podporu dalších sportů, které jsou těmi správnými dílky skládačky na vaší cestě.
        </p>
      </section>

      {/* Sekce 3 */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold" style={{ color: appColors.textPrimary }}>Sport není trest, ale výsada</h3>
        <p>
          Dnes se všichni za něčím honíme. V Selfrace ale nehoníme jen čísla. Mým cílem je, abychom se na každý trénink těšili. Abychom pohyb nebrali jako položku v seznamu úkolů, ale jako výsadu a radost. Protože si uvědomuji, že ne každý má to štěstí a zdraví, aby si mohl obout boty a vyběhnout ven.
        </p>
      </section>

      {/* Sekce 4 - zvýrazněná */}
      <section className="space-y-4 p-6 rounded-xl border" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: appColors.divider }}>
        <h3 className="text-xl font-bold" style={{ color: appColors.textPrimary }}>Tvůj trenér, tvoje data, tvoje cesta</h3>
        <p>
          Chtěl jsem vám přinést technologii, která se k vám přiblíží víc než jakýkoli statický plán z internetu. Díky analýze široké škály dat vám Selfrace nabízí tréninkové plány, které mají nejblíž k živému trenérovi.
        </p>
        <p className="font-medium text-base" style={{ color: appColors.textPrimary }}>
          Ale je tu jedno důležité pravidlo: Neporovnáváme se s ostatními.
        </p>
        <p className="italic text-base font-semibold" style={{ color: appColors.textPrimary }}>
          V Selfrace existuje jen jeden soupeř, kterého stojí za to překonat – tvoje včerejší já.
        </p>
      </section>

      {/* Sekce 5 */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold" style={{ color: appColors.textPrimary }}>Jsme v tom spolu</h3>
        <p>
          Za touto aplikací nestojí anonymní tým vývojářů. Stojím tu já a vy – komunita lidí, kteří milují pohyb. Selfrace jste i vy. Budu rád, když mi kdykoli napíšete, co vám v appce chybí nebo co bychom mohli udělat lépe. Každý váš postřeh posouvá Selfrace dopředu.
        </p>
        <p className="font-medium text-base pt-2" style={{ color: appColors.textPrimary }}>
          Pojďme se zlepšovat. Společně, ale každý ve svém tempu.
          <br />
          Vítej v Selfrace.
        </p>
      </section>

      {/* Podpis a fotka */}
      <AuthorSignature role="Zakladatel SelfRace" />
    </div>
  );
}