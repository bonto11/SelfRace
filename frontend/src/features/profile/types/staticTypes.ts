// src/features/profile/types/staticTypes.ts

export type Sex = "M" | "F" | null;

export type StaticProfile = {
  sex: Sex;
  /** "YYYY-MM-DD" alebo null */
  birth_date: string | null;
  height_cm: number | null;
};

export type StaticProfileSuccess = {
  success: true;
  data: StaticProfile;
};

export type StaticApiFail = {
  success: false;
  detail?: string;
};