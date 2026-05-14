export type CheckinItemType =
  | "listening"
  | "reading"
  | "writing"
  | "vocabulary"
  | "running";

export interface ActivitySettings {
  id: string;
  name: string;
  start_date: string;
  duration_days: number;
  checkin_start_time: string;
  checkin_end_time: string;
  is_active: boolean;
  current_day: number;
  progress_percent: number;
}

export interface CheckinAttachment {
  id: string;
  item_type: CheckinItemType;
  file_name?: string;
  display_name?: string;
  file_size: number;
  file_type: string;
  uploaded_at: string;
}

export interface CheckinItem {
  id?: string;
  item_type: CheckinItemType;
  is_valid: boolean;
  points: number;
  volume_score: number;
  listening_questions: number | null;
  reading_articles: number | null;
  reading_questions: number | null;
  writing_words: number | null;
  vocabulary_words: number | null;
  running_distance_km: number | null;
  running_pace_min_per_km: number | null;
  attachments: CheckinAttachment[];
}

export interface DailyCheckin {
  id: string;
  name: string;
  student_id: string;
  checkin_date: string;
  first_submitted_at: string;
  first_valid_at: string | null;
  earned_morning_bonus: boolean;
  base_points: number;
  total_points: number;
  total_volume: number;
  ip_address: string | null;
  updated_at: string;
  items: CheckinItem[];
}

export interface PublicDailyCheckin {
  checkin_date: string;
  first_submitted_at: string;
  first_valid_at: string | null;
  earned_morning_bonus: boolean;
  base_points: number;
  total_points: number;
  total_volume: number;
  updated_at: string;
  items: CheckinItem[];
}

export interface SubmissionResult {
  checkin: PublicDailyCheckin;
  message: string;
}

export interface Ranking {
  rank: number;
  name: string;
  student_id: string;
  total_points: number;
  base_points: number;
  morning_bonus_count: number;
  total_volume: number;
  valid_days: number;
  consecutive_days: number;
  listening_count: number;
  reading_count: number;
  writing_count: number;
  vocabulary_count: number;
  running_count: number;
  last_updated_at: string | null;
}

export interface PublicRanking {
  name: string;
  total_points: number;
  base_points: number;
  morning_bonus_count: number;
  total_volume: number;
  valid_days: number;
  consecutive_days: number;
  listening_count: number;
  reading_count: number;
  writing_count: number;
  vocabulary_count: number;
  running_count: number;
}

export interface PublicUserStats extends PublicRanking {
  latest_checkin: PublicDailyCheckin | null;
}

export interface AdminParticipantSummary {
  total_students: number;
  valid_checkin_records: number;
  students: Ranking[];
}

export interface AdminParticipantDetail {
  summary: Ranking;
  checkins: DailyCheckin[];
}

export interface Admin {
  id: string;
  username: string;
  created_at: string;
}

export interface PaginationResponse {
  items: DailyCheckin[];
  total: number;
  page: number;
  page_size: number;
}
