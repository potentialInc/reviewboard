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
  login_id: string;
  password: string;
  created_at: string;
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
}

/** Admin project list item */
export interface ProjectListItem {
  id: string;
  name: string;
  client_id: string | null;
  screen_count: number;
  open_feedback_count: number;
  slack_channel: string | null;
  created_at: string;
}

/** Screen with versions and feedback count (used in project detail) */
export interface ScreenItem {
  id: string;
  name: string;
  latest_version?: { image_url: string; version: number };
  open_feedback_count: number;
  screenshot_versions: ScreenshotVersion[];
}

/** Project detail (used in admin project detail page) */
export interface ProjectDetail {
  id: string;
  name: string;
  slack_channel: string | null;
  client_id: string | null;
  screens: ScreenItem[];
  created_at: string;
}

/** Feedback list item (used in admin feedback page) */
export interface FeedbackListItem {
  id: string;
  pin_number: number;
  x: number;
  y: number;
  text: string;
  author_id: string;
  status: FeedbackStatus;
  created_at: string;
  project_name: string;
  screen_name: string;
  reply_count: number;
  screenshot_version?: {
    image_url: string;
    screen?: { name: string };
  };
  replies?: Reply[];
}
