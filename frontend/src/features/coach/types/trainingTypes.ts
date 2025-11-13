// src/features/coach/types/trainingTypes.ts

export type SportCode = "run" | "ride" | "strength" | "swim";

export type RunTrainingTypeCode =
  | "run_easy"
  | "run_recovery"
  | "run_long"
  | "run_tempo"
  | "run_threshold"
  | "run_intervals"
  | "run_vo2max"
  | "run_hill_repeats"
  | "run_progression"
  | "run_fartlek"
  | "run_strides"
  | "run_race_pace";

export type StrengthTrainingTypeCode =
  | "strength_full_body"
  | "strength_upper"
  | "strength_lower"
  | "strength_core"
  | "strength_ocr_grip"
  | "strength_max"
  | "strength_hypertrophy"
  | "strength_tabata"
  | "strength_hiit"
  | "strength_emom"
  | "strength_circuit"
  | "strength_pyramid";

export type RideTrainingTypeCode =
  | "ride_easy_endurance"
  | "ride_recovery_spin"
  | "ride_long"
  | "ride_tempo"
  | "ride_sweet_spot"
  | "ride_threshold"
  | "ride_vo2max"
  | "ride_sprints"
  | "ride_hill_repeats"
  | "ride_cadence_drills";

export type SwimTrainingTypeCode =
  | "swim_easy_technique"
  | "swim_endurance"
  | "swim_intervals"
  | "swim_threshold"
  | "swim_speed"
  | "swim_drills"
  | "swim_open_water_sim";

export type TrainingTypeCode =
  | RunTrainingTypeCode
  | StrengthTrainingTypeCode
  | RideTrainingTypeCode
  | SwimTrainingTypeCode;

export interface TrainingTypeDef {
  /** Jedinečný kód – toto môže AI používať ako `session_type`. */
  code: TrainingTypeCode;
  /** Šport, pre ktorý tento typ platí. */
  sport: SportCode;
  /** Krátky label pre UI. */
  label: string;
  /** Stručný popis: čo tento tréning rozvíja / aký je charakter. */
  description: string;
}

/* ────────────────── RUN ────────────────── */

export const RUN_TRAINING_TYPES: TrainingTypeDef[] = [
  {
    code: "run_easy",
    sport: "run",
    label: "Easy run",
    description:
      "Pokojný beh v nízkej intenzite (Z1–Z2) na budovanie aerobnej bázy a podporu regenerácie bez veľkej únavy.",
  },
  {
    code: "run_recovery",
    sport: "run",
    label: "Recovery run",
    description:
      "Veľmi ľahký beh po náročnom tréningu alebo preteku, cieľom je len rozhýbať nohy a podporiť priechodnosť svalov.",
  },
  {
    code: "run_long",
    sport: "run",
    label: "Long run",
    description:
      "Dlhší beh v prevažne nízkej intenzite, zameraný na vytrvalosť, toleranciu záťaže nôh a mentálnu odolnosť.",
  },
  {
    code: "run_tempo",
    sport: "run",
    label: "Tempo run",
    description:
      "Sústredený beh v stredne vysokej intenzite, zvyčajne mierne pod alebo okolo pretekového tempa na 10 km.",
  },
  {
    code: "run_threshold",
    sport: "run",
    label: "Threshold run",
    description:
      "Beh v okolí laktátového prahu (Z3–Z4), zameraný na zlepšenie udržateľného rýchleho tempa a ekonomiky.",
  },
  {
    code: "run_intervals",
    sport: "run",
    label: "Intervaly",
    description:
      "Opakované úseky v vyššej intenzite s oddychom medzi, zamerané na rýchlosť, silu nôh a odolnosť voči únave.",
  },
  {
    code: "run_vo2max",
    sport: "run",
    label: "VO2max intervals",
    description:
      "Krátke až stredné intervaly vo veľmi vysokej intenzite (Z4–Z5) na zvýšenie VO2max a maximálnej aeróbnej kapacity.",
  },
  {
    code: "run_hill_repeats",
    sport: "run",
    label: "Hill repeats",
    description:
      "Opakované výbehy kopcov na rozvoj sily nôh, techniky a odolnosti voči stúpaním, často v Z3–Z5.",
  },
  {
    code: "run_progression",
    sport: "run",
    label: "Progression run",
    description:
      "Beh, kde sa tempo postupne zrýchľuje od easy po tempo/threshold, zameraný na kontrolu tempa a finish.",
  },
  {
    code: "run_fartlek",
    sport: "run",
    label: "Fartlek",
    description:
      "Striedanie rýchlejších a pomalších úsekov podľa pocitu alebo jednoduchého vzoru, hravý rozvoj rýchlosti a vytrvalosti.",
  },
  {
    code: "run_strides",
    sport: "run",
    label: "Strides",
    description:
      "Krátke svižné rovinky (15–30 s) s plnou regeneráciou, zamerané na techniku, kadenciu a pocit rýchlosti.",
  },
  {
    code: "run_race_pace",
    sport: "run",
    label: "Race-pace run",
    description:
      "Beh alebo intervaly v tempe plánovaného preteku (5 km, 10 km, polmaratón), na nácvik tempa a stratégie.",
  },
];

/* ────────────────── STRENGTH ────────────────── */

export const STRENGTH_TRAINING_TYPES: TrainingTypeDef[] = [
  {
    code: "strength_full_body",
    sport: "strength",
    label: "Full-body strength",
    description:
      "Komplexný tréning celého tela so základnými cvikmi, zameraný na funkčnú silu a stabilitu.",
  },
  {
    code: "strength_upper",
    sport: "strength",
    label: "Upper body",
    description:
      "Silový tréning zameraný na vrch tela (ťahy, tlaky, ramená), dôležitý pre držanie tela a OCR.",
  },
  {
    code: "strength_lower",
    sport: "strength",
    label: "Lower body",
    description:
      "Tréning zameraný na nohy (drepy, výpady, zadok, hamstringy) pre beh, kopce a odolnosť voči zraneniam.",
  },
  {
    code: "strength_core",
    sport: "strength",
    label: "Core & stability",
    description:
      "Tréning stredu tela, stability a kontrolovaného pohybu, dôležitý pre ekonomiku behu a prevenciu bolesti chrbta.",
  },
  {
    code: "strength_ocr_grip",
    sport: "strength",
    label: "OCR / grip",
    description:
      "Tréning úchopu, chrbta a ťahových vzorov pre prekážkové behy (TRX, hrazda, úchopy, farmer’s walk).",
  },
  {
    code: "strength_max",
    sport: "strength",
    label: "Max strength",
    description:
      "Ťažké váhy s nízkym počtom opakovaní, cieľom je zvýšiť maximálnu silu a nervovo-svalovú koordináciu.",
  },
  {
    code: "strength_hypertrophy",
    sport: "strength",
    label: "Hypertrophy",
    description:
      "Stredné váhy a vyšší počet opakovaní na budovanie svalovej hmoty a zlepšenie tolerance objemu.",
  },
  {
    code: "strength_tabata",
    sport: "strength",
    label: "Tabata",
    description:
      "Krátke vysoko intenzívne intervaly (napr. 20 s práca / 10 s pauza), zamerané na kondíciu a metabolický stres.",
  },
  {
    code: "strength_hiit",
    sport: "strength",
    label: "HIIT",
    description:
      "Vysoko intenzívny intervalový tréning celého tela, často v kruhoch, s krátkymi pauzami.",
  },
  {
    code: "strength_emom",
    sport: "strength",
    label: "EMOM",
    description:
      "Every Minute On the Minute – na začiatku každej minúty predpísané opakovania, potom zvyšok minúty oddych.",
  },
  {
    code: "strength_circuit",
    sport: "strength",
    label: "Circuit training",
    description:
      "Kruhový tréning s viacerými stanovišťami, striedajúci cviky na celé telo pre silu aj kondíciu.",
  },
  {
    code: "strength_pyramid",
    sport: "strength",
    label: "Pyramid",
    description:
      "Postupné zvyšovanie a následné znižovanie počtu opakovaní alebo váhy, zamerané na silu aj vytrvalosť.",
  },
];

/* ────────────────── RIDE (BIKE) ────────────────── */

export const RIDE_TRAINING_TYPES: TrainingTypeDef[] = [
  {
    code: "ride_easy_endurance",
    sport: "ride",
    label: "Easy endurance",
    description:
      "Pokojná jazda v nízkej intenzite, zameraná na vytrvalosť a objem bez veľkej únavy.",
  },
  {
    code: "ride_recovery_spin",
    sport: "ride",
    label: "Recovery spin",
    description:
      "Veľmi ľahká, krátka jazda s nízkym odporom na rozhýbanie nôh a podporu regenerácie.",
  },
  {
    code: "ride_long",
    sport: "ride",
    label: "Long ride",
    description:
      "Dlhšia jazda v nízkej až strednej intenzite, buduje základnú cyklo vytrvalosť a toleranciu sedu.",
  },
  {
    code: "ride_tempo",
    sport: "ride",
    label: "Tempo ride",
    description:
      "Jazda v stredne vysokej intenzite, nad komfortnou Z2, zameraná na udržateľnú silu a výkon.",
  },
  {
    code: "ride_sweet_spot",
    sport: "ride",
    label: "Sweet spot",
    description:
      "Jazda alebo intervaly tesne pod prahom (okolo sweet-spotu), efektívny kompromis medzi objemom a intenzitou.",
  },
  {
    code: "ride_threshold",
    sport: "ride",
    label: "Threshold intervals",
    description:
      "Intervaly v okolí funkčného prahového výkonu (FTP), zamerané na zlepšenie udržateľného výkonu.",
  },
  {
    code: "ride_vo2max",
    sport: "ride",
    label: "VO2max intervals",
    description:
      "Krátke intervaly vo vysokej intenzite nad prahom, zamerané na zvýšenie VO2max a toleranciu vysokého výkonu.",
  },
  {
    code: "ride_sprints",
    sport: "ride",
    label: "Sprints",
    description:
      "Krátke maximálne šprinty s plnou regeneráciou, zamerané na neuromuskulárnu silu a špičkový výkon.",
  },
  {
    code: "ride_hill_repeats",
    sport: "ride",
    label: "Hill repeats",
    description:
      "Opakované výjazdy do kopca, zamerané na silu nôh, kadenciu a zvládanie stúpaní.",
  },
  {
    code: "ride_cadence_drills",
    sport: "ride",
    label: "Cadence drills",
    description:
      "Cielené bloky s vyššou alebo nižšou kadenciou, na zlepšenie šliapania a kontroly nad frekvenciou.",
  },
];

/* ────────────────── SWIM ────────────────── */

export const SWIM_TRAINING_TYPES: TrainingTypeDef[] = [
  {
    code: "swim_easy_technique",
    sport: "swim",
    label: "Easy / technique",
    description:
      "Pokojné plávanie s dôrazom na techniku, dýchanie a pocit z vody, minimálna intenzita.",
  },
  {
    code: "swim_endurance",
    sport: "swim",
    label: "Endurance",
    description:
      "Dlhšie úseky v strednej intenzite na budovanie vytrvalosti a ekonomiky plávania.",
  },
  {
    code: "swim_intervals",
    sport: "swim",
    label: "Intervals",
    description:
      "Opakované úseky s pevne danou dĺžkou a pauzou, zamerané na rýchlosť a kondíciu.",
  },
  {
    code: "swim_threshold",
    sport: "swim",
    label: "Threshold",
    description:
      "Úseky v okolí prahu, zamerané na schopnosť udržať vyššie tempo s dobrou technikou.",
  },
  {
    code: "swim_speed",
    sport: "swim",
    label: "Speed",
    description:
      "Krátke rýchlostné úseky s dôrazom na explozívnu silu a techniku pri vyššom tempe.",
  },
  {
    code: "swim_drills",
    sport: "swim",
    label: "Drills",
    description:
      "Technické cvičenia (napr. jednoruké plávanie, catch-up) na zlepšenie zábere, polohy tela a dýchania.",
  },
  {
    code: "swim_open_water_sim",
    sport: "swim",
    label: "Open water simulation",
    description:
      "Tréning simulujúci otvorenú vodu (dlhšie úseky, menej odpočinku, orientácia, kontinuálne tempo).",
  },
];

/* ────────────────── AGREGÁTY / HELPER FUNKCIE ────────────────── */

export const TRAINING_TYPES: TrainingTypeDef[] = [
  ...RUN_TRAINING_TYPES,
  ...STRENGTH_TRAINING_TYPES,
  ...RIDE_TRAINING_TYPES,
  ...SWIM_TRAINING_TYPES,
];

export const TRAINING_TYPES_BY_SPORT: Record<SportCode, TrainingTypeDef[]> = {
  run: RUN_TRAINING_TYPES,
  strength: STRENGTH_TRAINING_TYPES,
  ride: RIDE_TRAINING_TYPES,
  swim: SWIM_TRAINING_TYPES,
};

export function getTrainingType(code: TrainingTypeCode): TrainingTypeDef | undefined {
  return TRAINING_TYPES.find((t) => t.code === code);
}