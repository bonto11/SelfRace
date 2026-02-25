export type UserSettings = {
  units: "metric" | "imperial";
  language: "sk" | "en";
  timezone: string;
  week_start: "Mon" | "Sun";
  date_format: string;
  time_format_24h: boolean;
};

export type AccountDeleteState = "none" | "pending" | "cancelled" | "deleted";

export type AccountDeleteStatus = {
  user_id: number;
  pending: boolean;
  status: AccountDeleteState;
  requested_at: string | null;
  delete_at: string | null;
  cancelled_at: string | null;
  hard_deleted_at: string | null;
};