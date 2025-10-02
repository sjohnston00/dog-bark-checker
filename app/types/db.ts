export type Detection = {
  id: number;
  timestamp: string;
  confidence: number;
  duration: number | null;
  source: string;
  model_used: string | null;
  audio_features: string | null;
  ensemble_info: string | null;
  created_at: string;
};
