export const sk = {
  common: {
    and : "a"
  },
  landing: {
    h1: "Tvoj osobný tréner, ktorý reaguje na váš stav v reálnom čase.",
    p1: "Prepojíš Stravu, nastavíš cieľ a aplikácia ti bude stavať tréningové bloky, výkonnosť a sledovať mieru regenerácie a únavy.",
    ctaStart: "Vyskúšať zdarma",
    ctaSignIn: "Prihlásiť sa",
    foot: "Detailné metriky behu, tréningové zóny a AI tréner po prepojení účtu.",
  },
  signIn: {
    checkMail:
      "Poslali sme ti e-mail s odkazom na zmenu hesla. Skontroluj inbox/spam.",
    loginFailed: "Prihlásenie zlyhalo.",
    loginTitle: "Prihlásenie",
    loginDescription: "Vráť sa späť k svojim tréningom, plánom a AI trénerovi.",
    loginPlaceholder: "Zadaj mail",
    loginPassword: "Zadaj heslo",
    logIn: "Prihlásiť sa",
    logingIn: "Prihlasujem...",
    btnForgotPassword: "Zabudnuté heslo?",
    haveAccount: "Nemáš účet? ",
    btnRegister: "Registruj sa",
    footer: "Import aktivít a detailné metriky sú dostupné po prepojení Stravy.",
  },
  signUp: {
    confirm:
      "Prosím potvrď, že rozumieš podmienkam používania.",
    registerFailed: "Registrácia zlyhala.",
    registerCheckMail: "Skontroluj e-mail a potvrď registráciu.",
    registerTitle: "Vytvoriť účet",
    registerDescription: "Sleduj tréningy, analyzuj dáta a nechaj AI trénera pripraviť plán na mieru.",
    registerPlaceholder: "Meno (voliteľné)",
    registerMail: "Zadaj mail",
    registerPassword: "Zadaj silné heslo",
    termsDesc: "Kliknutím na Registrovať súhlasíš s našími ",
    termsTitle: "Podmienkami používania",
    privacyTitle: " Pravidlami ochrany súkromia",
    confirmMedical: "Rozumiem, že SelfRace nie je lekársky nástroj a tréningové poznatky používam na vlastné riziko.",
    confirmMedicalHint: "(Potrebné na založenie účtu)",
    register: "Registrovať",
    registering: "Registrujem…",
    btnForgotPassword: "Zabudnuté heslo?",
    haveAccount: "Už máš účet? ",
    btnSignin: "Prihlás sa",
    footer: "Stravu prepojíš po registrácii v sekcii Connected Apps.",
  },
  userMenu: {
    account: "Účet",
    connectedApps: "Pripojené aplikácie",
    logginOff: "Odhlasujem…",
    logoff: "Odhlásiť sa",
  },
  prefs: {
    sections: {
      daysSection: {
        widget: {
          title: "Dni tréningu",
          tooltip: [
            "Toto nastavenie určuje, v ktoré dni má tréner plánovať tréningy. Nejde len o „koľko“, ale najmä o to, ako sa záťaž rozloží v týždni.",
            "",
            "Prečo je to dôležité:",
            "• Rovnaký týždenný objem sa dá postaviť bezpečne aj nebezpečne – rozhoduje rozloženie (kontrast easy vs hard, oddych medzi).",
            "• Menej tréningových dní = viac regenerácie medzi jednotkami, ale často vyššia náročnosť na jeden tréningový deň.",
            "• Viac tréningových dní = lepšie rozloženie záťaže, ale vyššie riziko monotónnosti, ak sú dni príliš podobné.",
            "",
            "Prakticky:",
            "• Ak máš sklony k preťaženiu (holene/achilovky/úpony), je výhodné mať jasné easy alebo rest dni.",
            "• Ak máš pevné klubové tréningy, nastav dni tak, aby s nimi plán automaticky rátal.",
          ].join("\n"),
        },
      },

      focusAvoidSection: {
        widget: {
          title: "Zameranie a obmedzenia",
          tooltip: [
            "Tu nastavíš mantinely: na čo sa má tréner viac sústrediť a čomu sa má vyhnúť. Je to „riadidlo“ pre AI – bez toho ľahko navrhne univerzálny plán, ktorý ti nemusí sedieť.",
            "",
            "Na čo je to dobré:",
            "• Pomáha udržať plán realistický (čas, regenerácia, pracovné dni, preferencie).",
            "• Znižuje riziko preťaženia – AI nebude tlačiť veci, ktoré u teba často končia bolesťou alebo únavou.",
            "",
            "Čo sem patrí:",
            "• „Chcem viac rýchlosti / kopce / techniku / vytrvalosť“",
            "• „Nechcem 2 tvrdé dni po sebe“",
            "• „Nechcem veľa skokov / plyometrie“",
            "• „Zhyby/visy max 1× týždenne“ (presne tento typ pravidla sem dáva najväčší zmysel)",
            "",
            "Tip:",
            "• Ak máš jeden konkrétny problém (napr. holene), je lepšie ho sem napísať explicitne – AI potom nebude stavať týždeň „na hrane“.",
          ].join("\n"),
        },
      },

      goalSection: {
        widget: {
          title: "Cieľ",
          tooltip: [
            "Cieľ je hlavný kompas celého plánu. Mení typ tréningov, pomer easy vs hard, aj to, ako rýchlo sa má zvyšovať záťaž.",
            "",
            "Ako to ovplyvní plán:",
            "• 5 km výkon: viac práce na rýchlosti a ekonomike (intervaly, tempo, krátke kvalitné bloky).",
            "• Vytrvalosť / dlhé preteky: viac ľahkého objemu, dlhšie behy, postupné navyšovanie času v pohybe.",
            "• Kopce / OCR: viac špecifických podnetov (stúpania, sila, odolnosť), ale stále s kontrolou únavy.",
            "",
            "Tip:",
            "• Najlepšie funguje konkrétny cieľ (pretek/dátum/priorita). Keď je cieľ neurčitý, plán býva príliš „všeobecný“ a progres je pomalší.",
          ].join("\n"),
        },
      },

      injuriesSection: {
        widget: {
          title: "Zranenia a riziká",
          tooltip: [
            "Toto nastavenie mení návrh tréningu. Nie je to len poznámka – tréner podľa toho upraví štruktúru záťaže, typy tréningov a regeneráciu.",
            "",
            "Čo sa typicky zmení:",
            "• Menej rizikových kombinácií (napr. príliš veľa intenzity + príliš veľa objemu naraz).",
            "• Viac kontrolovaných easy dní, prípadne kratšie tvrdé bloky s lepším oddychom.",
            "• Viac doplnkov (strength/rehab) tam, kde to dáva zmysel.",
            "",
            "Prakticky:",
            "• Aj „len citlivé“ miesto sem patrí – cieľ je predchádzať, nie hasiť problém, keď sa rozbehne.",
            "• Ak sa ti vracia tá istá bolesť, je lepšie byť konzervatívny 2–3 týždne než sa cykliť v zraneniach.",
          ].join("\n"),
        },
      },

      planStartSection: {
        widget: {
          title: "Začiatok plánu",
          tooltip: [
            "Toto je dátum, od ktorého sa plán počíta. Ovplyvňuje týždňové bloky (Week 1, Week 2…), porovnania trendov a napárovanie na kalendár.",
            "",
            "Prečo na tom záleží:",
            "• Plán sa viaže na týždne – keď posunieš štart, zmení sa, čo je „aktuálny týždeň“ a kde má byť progres/oddych.",
            "• Trendy (load, monotony, strain) sa potom interpretujú konzistentne.",
            "",
            "Tip:",
            "• Ak chceš, aby plán štartoval od pondelka, nastav to explicitne. Je to jednoduchšie na hlavu aj na režim.",
          ].join("\n"),
        },
      },

      rehabSection: {
        widget: {
          title: "Rehab / Prehab",
          tooltip: [
            "Rehab je miesto, kde povieš: „toto potrebujem robiť, aby som bol zdravý“. Má to byť nízko-stresová, pravidelná rutina, ktorá dlhodobo drží telo pokope.",
            "",
            "Rehab vs Strength:",
            "• Rehab = stabilita, mobilita, kompenzácie, návrat po zranení. Menšia únava, vyššia frekvencia.",
            "• Strength = silový tréning ako výkonová zložka. Väčšia únava, väčší zásah do regenerácie.",
            "",
            "Prakticky:",
            "• Lepšie 10 min rehab 4× týždenne než 40 min raz za týždeň.",
            "• Ak máš slabé miesto (bedro/koleno/holene), rehab býva najlepší „ROI“ zo všetkých doplnkov.",
          ].join("\n"),
        },
      },

      rulesSection: {
        widget: {
          title: "Pravidlá generovania",
          tooltip: [
            "Toto sú tvoje hard pravidlá pre trénera. Čokoľvek, čo sem dáš, by mal plán rešpektovať vždy – aj keď by sa inak AI snažila „optimalizovať“ agresívnejšie.",
            "",
            "Príklady dobrých pravidiel:",
            "• „Easy behy chcem držať skutočne ľahké (Z2).“",
            "• „Nechcem 2 tvrdé dni po sebe.“",
            "• „Zhyby/visy max 1× týždenne.“",
            "• „Keď som unavený, radšej uber objem než pridaj intenzitu.“",
            "",
            "Prečo to je kritické:",
            "• Bez pravidiel sa plán môže stať teoreticky super, ale prakticky neudržateľný.",
            "• Najlepší dlhodobý progres robí konzistentnosť, nie dokonalý týždeň raz za mesiac.",
          ].join("\n"),
        },
      },

      sportsSection: {
        widget: {
          title: "Športy",
          tooltip: [
            "Vyber športy, ktoré chceš, aby plán zahŕňal (alebo aby s nimi rátal). Hlavný šport určuje, okolo čoho sa plán točí. Doplnkové športy sú podpora.",
            "",
            "Ako to ovplyvní plán:",
            "• Main sport = priorita (napr. beh bude mať hlavné kvalitné jednotky).",
            "• Add-ons = doplnky (napr. bike ako low-impact objem, strength ako prevencia).",
            "",
            "Tip:",
            "• Keď vyberieš priveľa športov naraz, plán sa môže „rozriediť“. Lepšie je mať jasnú prioritu a ostatné ako podporné.",
          ].join("\n"),
        },
      },

      strengthSection: {
        widget: {
          title: "Silový tréning",
          tooltip: [
            "Silový tréning pomáha výkonu aj prevencii zranení, ale zároveň zvyšuje únavu. Dôležité nie je len „či“, ale aj „koľko“ a „kedy“.",
            "",
            "Čo to mení v pláne:",
            "• počet silových dní a ich rozloženie v týždni",
            "• či má byť silový tréning skôr udržiavací (ľahší) alebo rozvojový (ťažší)",
            "• koľko regenerácie musí plán nechať, aby nepadla kvalita behov",
            "",
            "Prakticky:",
            "• Keď máš intervaly/tempo, silu dávaj tak, aby ti nezabila ďalší kvalitný tréning.",
            "• Pri sklone k shin splints často pomáha: lýtka + tibialis + stabilita bedier viac než „hero“ fullbody do zlyhania.",
          ].join("\n"),
        },
      },

      thresholdsSection: {
        widget: {
          title: "Prahy a testy",
          tooltip: [
            "Prahy sú základ pre správne intenzity a zóny. Keď je prah nastavený zle, celé tréningy sú posunuté – easy môže byť zbytočne tvrdé a tvrdé tréningy môžu byť mimo cieľ.",
            "",
            "Prečo na tom záleží:",
            "• Zóny sa počítajú z prahu – jeden zlý údaj vie zmeniť celý tréningový mix.",
            "• Správny prah = lepšie dávkovanie únavy = lepší progres.",
            "",
            "Tip:",
            "• Prah sa mení s formou. Je normálne ho občas aktualizovať, najmä keď ideš blok na výkon (napr. 5 km).",
            "• Lepšie mať „dostatočne presný“ prah konzistentne, než naháňať dokonalé číslo každé 2 týždne.",
          ].join("\n"),
        },
      },

      volumeSection: {
        widget: {
          title: "Objem",
          tooltip: [
            "Objem je najväčší driver progresu aj zranení. Najčastejší problém nie je „málo intervalov“, ale príliš rýchly skok objemu alebo zlá kombinácia objemu a intenzity.",
            "",
            "Čo to ovplyvní:",
            "• koľko tréningového času/objemu bude v týždni",
            "• ako rýchlo sa má týždeň po týždni zvyšovať záťaž",
            "• či plán zaradí deload (ľahší) týždeň v správny moment",
            "",
            "Prakticky:",
            "• Skoky +20% týždenne sú často recept na holene/achilovky/kolená.",
            "• Konzistentný, udržateľný objem porazí agresívny plán, ktorý musíš stále prerušovať.",
          ].join("\n"),
        },
      },

      zonesSection: {
        widget: {
          title: "Zóny",
          tooltip: [
            "Zóny sú „jazyk“, ktorým sa plán baví s tvojím telom. Ovládajú, čo je easy/recovery, čo je tempo/threshold a aký stres nesie každý tréning.",
            "",
            "Prečo sú zóny kľúčové:",
            "• Ak sú zóny posunuté, začneš robiť easy príliš tvrdo → únava sa hromadí a forma nerastie.",
            "• Správne zóny zlepšujú konzistenciu a držia pod kontrolou riziko preťaženia.",
            "",
            "Tip:",
            "• Keď chceš, aby easy bol naozaj easy, musíš mať prah a zóny nastavené konzistentne (napr. LTHR schéma).",
            "• Zóny majú byť jednotné naprieč appkou – keď raz zvolíš schému, drž sa jej.",
          ].join("\n"),
        },
      },
    },
  },
} as const;
