// src/features/performance/types/bodyScan.ts

export type SegmentalPart = {
  kg: number | null;
  pct: number | null;
  eval: string | null;
};

export type SegmentalAnalysis = {
  lean: {
    left_arm: SegmentalPart;
    right_arm: SegmentalPart;
    trunk: SegmentalPart;
    left_leg: SegmentalPart;
    right_leg: SegmentalPart;
  };
  fat: {
    left_arm: SegmentalPart;
    right_arm: SegmentalPart;
    trunk: SegmentalPart;
    left_leg: SegmentalPart;
    right_leg: SegmentalPart;
  };
};

export type BodyScan = {
  id: number;
  user_id: number;
  scan_date: string;
  scan_time: string | null;
  scan_source: string;

  weight_kg: number | null;
  height_cm: number | null;

  total_body_water_l: number | null;
  protein_kg: number | null;
  mineral_kg: number | null;
  body_fat_mass_kg: number | null;
  skeletal_muscle_mass_kg: number | null;

  weight_range_min: number | null;
  weight_range_max: number | null;
  smm_range_min: number | null;
  smm_range_max: number | null;
  body_fat_mass_range_min: number | null;
  body_fat_mass_range_max: number | null;

  bmi: number | null;
  pbf_percent: number | null;

  waist_hip_ratio: number | null;
  visceral_fat_level: number | null;
  basal_metabolic_rate_kcal: number | null;
  inbody_score: number | null;
  obesity_degree_percent: number | null;
  smi: number | null;

  segmental_analysis: SegmentalAnalysis | null;
  raw_extraction: Record<string, any> | null;
  source_image_path: string | null;

  confirmed_by_user: boolean;
  manually_edited: boolean;
  ai_model_used: string | null;

  created_at: string;
  updated_at: string;
};

export type BodyScanUploadResult = {
  scan: BodyScan;
  extraction_confidence: "high" | "medium" | "low" | null;
  unreadable_fields: string[];
};

export type BodyScanApiSuccess<T> = {
  success: true;
  data: T;
  error_code: null;
  message: null;
};

export type BodyScanApiFail = {
  success: false;
  data: null;
  error_code: string;
  message: string | null;
};
