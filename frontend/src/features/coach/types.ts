export type CoachPrefs = {
  weeks: number;
  sports: ("run"|"ride"|"strength"|"mixed"|"skate")[];
  daysOff: ("Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun")[];
  longRunDays: ("Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun")[];
  avoidTwoHardInRow: boolean;
  useZones: boolean;
  includeStrides: boolean;
};

export type PBRun = {
  distanceKm: number;        // 1,5,10,21.1,42.2...
  best: string;              // "00:23:18"
  activityId?: number | null;
  date?: string | null;      // ISO
};