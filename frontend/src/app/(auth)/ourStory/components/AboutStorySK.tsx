"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import AuthorSignature from "./AuthorSignature";

export default function AboutStorySK() {
  return (
    <div className="space-y-8 text-sm leading-relaxed" style={{ color: appColors.textMuted }}>
      
      {/* Hlavný nadpis */}
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: appColors.textPrimary }}>Príbeh Selfrace: Od športovca, pre športovcov</h2>
      </div>

      {/* Sekcia 1 */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold" style={{ color: appColors.textPrimary }}>Prečo to celé vzniklo?</h3>
        <p>
          Budem k vám úprimný – Selfrace nevznikla v zasadačke marketingovej agentúry. Vznikla vonku cez longruny a pri nespočetných hodinách hľadania nástroja, ktorý by mi skutočne vyhovoval. Všade mi niečo chýbalo. Niekde to bolo príliš komplikované, inde až príliš povrchné a väčšina vecí nereagovala na môj reálny stav.
        </p>
        <p>
          Tak som začal programovať po nociach. Najprv len pre seba. Chcel som aplikáciu, ktorú budem sám s radosťou otvárať každé ráno. A presne to robím – Selfrace používam naplno každý deň.
        </p>
      </section>

      {/* Sekcia 2 */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold" style={{ color: appColors.textPrimary }}>Viac než len beh</h3>
        <p>
          Mojou vášňou je beh, hoci možno nemám tie najlepšie atletické predispozície. Možno práve preto ma to tak baví – vidím ten obrovský priestor na zlepšenie. Ale viem, že bežec nie je len o nohách. Selfrace stojí na rovnováhe. Integroval som do nej silovú časť a podporu pre ďalšie športy, ktoré sú tými správnymi dielikmi skladačky na vašej ceste.
        </p>
      </section>

      {/* Sekcia 3 */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold" style={{ color: appColors.textPrimary }}>Šport nie je trest, ale výsada</h3>
        <p>
          Dnes sa všetci za niečím naháňame. V Selfrace však nenaháňame len čísla. Mojím cieľom je, aby sme sa na každý tréning tešili. Aby sme pohyb nebrali ako položku v zozname úloh, ale ako výsadu a radosť. Lebo si uvedomujem, že nie každý má to šťastie a zdravie, aby si mohol obuť tenisky a vybehnúť von.
        </p>
      </section>

      {/* Sekcia 4 - Zvýraznená */}
      <section className="space-y-4 p-6 rounded-xl border" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: appColors.divider }}>
        <h3 className="text-xl font-bold" style={{ color: appColors.textPrimary }}>Tvoj tréner, tvoje dáta, tvoja cesta</h3>
        <p>
          Chcel som vám priniesť technológiu, ktorá sa k vám priblíži viac než akýkoľvek statický plán z internetu. Vďaka analýze širokej škály dát vám Selfrace ponúka tréningové plány, ktoré majú najbližšie k živému trénerovi.
        </p>
        <p className="font-medium text-base" style={{ color: appColors.textPrimary }}>
          Ale je tu jedno dôležité pravidlo: Neporovnávame sa s ostatnými.
        </p>
        <p className="italic text-base font-semibold" style={{ color: appColors.textPrimary }}>
          V Selfrace existuje len jeden súper, ktorého stojí za to prekonať – tvoje včerajšie ja.
        </p>
      </section>

      {/* Sekcia 5 */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold" style={{ color: appColors.textPrimary }}>Sme v tom spolu</h3>
        <p>
          Za touto aplikáciou nestojí anonymný tím vývojárov. Stojím tu ja a vy – komunita ľudí, ktorí milujú pohyb. Selfrace ste aj vy. Budem rád, ak mi kedykoľvek napíšete, čo vám v appke chýba, alebo čo by sme mohli urobiť lepšie. Každý váš postreh posúva Selfrace vpred.
        </p>
        <p className="font-medium text-base pt-2" style={{ color: appColors.textPrimary }}>
          Poďme sa zlepšovať. Spoločne, ale každý vo svojom tempe.
          <br />
          Vitaj v Selfrace.
        </p>
      </section>

      {/* Podpis a fotka */}
      <AuthorSignature />
    </div>
  );
}