export type SyncActivitiesOptions = {
  forceLastDays?: number | null;
  fetchDetails?: boolean;
};

export type SyncActivitiesStats = {
  imported: number;
  updated: number;
  skipped: number;
  fetched: number;
};

export type SyncActivitiesResponse = {
  success: boolean;
  stats: SyncActivitiesStats;
  note?: string | null;
};