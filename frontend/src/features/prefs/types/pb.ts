export type PBRunFormState = {
  distance_m: string;
  time_str: string; // hh:mm:ss
  achieved_at: string; // YYYY-MM-DD
  activity_id: string; // "" alebo číslo v texte
  activity_name?: string;
};