export type FeedbackStatus = 'open' | 'in-progress' | 'resolved';

export interface Project {
  id: string;
  name: string;
  slack_channel: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientAccount {
  id: string;
  project_id: string | null;
  login_id: string;
  password: string;
  created_at: string;
  project?: Project;
  projects?: Project[];
}

export interface Screen {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  latest_version?: ScreenshotVersion;
  open_feedback_count?: number;
}

export interface ScreenshotVersion {
  id: string;
  screen_id: string;
  version: number;
  image_url: string;
  created_at: string;
}

export interface Comment {
  id: string;
  screenshot_version_id: string;
  pin_number: number;
  x: number;
  y: number;
  text: string;
  author_id: string;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  replies?: Reply[];
  screen_name?: string;
  project_name?: string;
}

export interface Reply {
  id: string;
  comment_id: string;
  text: string;
  author_type: 'admin' | 'client';
  author_id: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  actor: string;
  created_at: string;
}

export interface DashboardStats {
  total_projects: number;
  total_open_feedback: number;
  feedback_today: number;
  feedback_this_week: number;
}

export interface SessionUser {
  type: 'admin' | 'client';
  id: string;
  login_id: string;
  project_id?: string;
}
