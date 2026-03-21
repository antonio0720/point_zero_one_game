/**
 * AppealResponse contract
 */

export interface AppealResponse {
  appeal_id: string;
  status: string;
  submitted_at: Date;
  next_update_eta: Date;
  redacted_summary: string;
  receipt_id: string;
}
