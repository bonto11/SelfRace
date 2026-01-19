export type UserSettings = {
  units: "metric" | "imperial";
  language: "sk" | "en";
  timezone: string;
  week_start: "Mon" | "Sun";
  date_format: string;
  time_format_24h: boolean;
};

export type AccountDeleteStatus = {
  pending: boolean;
  delete_at: string | null; // ISO dátum v UTC alebo s offsetom
};
