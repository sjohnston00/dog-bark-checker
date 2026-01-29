export type Detection = {
  id: number
  timestamp: string
  confidence: number
  duration: number | null
  source: string
  model_used: string | null
  audio_features: string | null
  ensemble_info: string | null
  created_at: string
}

export type TimePeriod = {
  id: number
  date: string //DB stores as TEXT
  start_time: string //DB stores as TEXT
  end_time: string //DB stores as TEXT
  notes: string | null
  created_at: string //DB stores as TEXT
}
