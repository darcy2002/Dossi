export type SessionStatus =
  | "pending"
  | "running"
  | "needs_review"
  | "complete"
  | "failed";

export interface User {
  id: number;
  email: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SourceRef {
  url: string;
  title: string;
}

export interface Report {
  company_overview: string;
  products_and_services: string;
  target_customers: string;
  business_signals: string[];
  risks_and_challenges: string[];
  suggested_discovery_questions: string[];
  suggested_outreach_strategy: string;
  unknowns: string[];
  sources: SourceRef[];
}

export interface SessionListItem {
  id: number;
  company_name: string;
  status: SessionStatus;
  created_at: string;
}

export interface SessionDetail {
  id: number;
  company_name: string;
  website: string;
  objective: string;
  status: SessionStatus;
  current_step: string | null;
  report_json: Report | null;
  sources_json: SourceRef[] | null;
  error_log_json: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface SessionStatusResponse {
  id: number;
  status: SessionStatus;
  current_step: string | null;
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export const TERMINAL_STATUSES: SessionStatus[] = [
  "complete",
  "needs_review",
  "failed",
];
