// typ aktivity pre výber
export type MiniActivity = {
  id: number;
  name: string;
  start_date: string; // ISO
  sport: string;
  distance_km?: number | null;
  duration_min?: number | null;
};
