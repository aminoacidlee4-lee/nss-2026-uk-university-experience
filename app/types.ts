export type SubjectLevel = 'All' | 'CAH1' | 'CAH2' | 'CAH3';
export type CahLevel = Exclude<SubjectLevel, 'All'>;

export interface ThemeMetric {
  positivity: number | null;
  benchmark: number | null;
  confidence_interval_95_lower: number | null;
  confidence_interval_95_upper: number | null;
  responses_fpe: number | null;
  benchmark_standard_deviation: number | null;
  difference_from_benchmark_ppt: number | null;
  suppression_reason: string | null;
}

export type ThemeKey =
  | 'teaching'
  | 'learning_opportunities'
  | 'assessment_feedback'
  | 'academic_support'
  | 'organisation_management'
  | 'learning_resources'
  | 'student_voice';

export interface SubjectResult {
  provider_name: string;
  UKPRN: string;
  subject_level: 'All subjects' | CahLevel;
  subject_code: string;
  subject_name: string;
  metrics: Record<ThemeKey, ThemeMetric>;
  experience_score_calculated: number | null;
  experience_score_status: string;
  respondents: number | null;
  eligible_population_fpe: number | null;
  response_rate: number | null;
  suppression_flags: string[];
  data_availability: 'published';
  source: string;
  notes: string;
}

export interface UniversityIndexItem {
  UKPRN: string;
  provider_name: string;
  has_overall: boolean;
  record_count: number;
}

export interface ProviderDataset {
  schema_version: string;
  UKPRN: string;
  provider_name: string;
  overall: SubjectResult | null;
  subjects: Record<CahLevel, SubjectResult[]>;
}

export interface SubjectCatalogItem {
  code: string;
  name: string;
  parent_code: string | null;
}

export type SubjectCatalog = Record<CahLevel, SubjectCatalogItem[]>;

export interface DataManifest {
  dataset: string;
  schema_version: string;
  year: number;
  generated_at: string;
  university_count: number;
  record_count: number;
  counts_by_level: Record<SubjectLevel, number>;
  theme_count: number;
}
