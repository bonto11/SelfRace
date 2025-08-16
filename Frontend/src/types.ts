// Typ jednej aktivity tak, ako ju teraz posiela backend po normalizácii na SI jednotky.
// SI polia:
// - distance_m (metre)
// - moving_time_s (sekundy)
// - elapsed_time_s (sekundy)
// - average_speed_mps (metre za sekundu)
// - average_heartrate_bpm, max_heartrate_bpm (údery za minútu)
// - elevation_gain_m (metre)
// - pace_min_per_km (string "m:ss"), pace_seconds_per_km (sekundy na kilometer)
//
// Voliteľne backend posiela aj surové polia z DB ako debug (môžeš ignorovať alebo odstrániť):
// - distance_km, moving_time_min, elapsed_time_raw, avg_speed_raw

export type ActivitySummary = {
  id: number;
  user_id: number;
  name: string | null;
  date: string; // ISO reťazec

  // Normalizované SI polia
  distance_m: number | null;                // metre
  moving_time_s: number | null;             // sekundy
  average_speed_mps: number | null;         // m/s
  average_heartrate_bpm: number | null;     // bpm
  max_heartrate_bpm: number | null;         // bpm
  elevation_gain_m: number | null;          // metre

  // Odvodené polia
  pace_seconds_per_km: number | null;       // sekundy na kilometer
  pace_min_per_km: string | null;           // formát "m:ss"

  // (voliteľné debug polia z backendu – môžeš odstrániť, ak ich nepotrebuješ)
  distance_km?: number | null;
  moving_time_min?: number | null;
  elapsed_time_raw?: number | null;
  avg_speed_raw?: number | null;
};

export type ActivityDetailRow = {
  user_id: number;
  activity_id: number;
  activity_date: string | null;  // ISO alebo null
  time: number | null;           // sekundy od štartu
  lat: number | null;
  lng: number | null;
  altitude_m: number | null;
  heartrate_bpm: number | null;
  cadence_rpm: number | null;
  speed_m_s: number | null;      // m/s
};
