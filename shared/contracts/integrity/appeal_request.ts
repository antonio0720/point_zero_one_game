/**
 * AppealRequest contract for integrity module
 */

export interface AppealRequest {
  run_id: number;
  reason_code: string;
  free_text: string;
  optional_link?: string;
  attachment_policy_refs: string[];
}

/**
 * Client schema validation for AppealRequest
 */
export type AppealRequestValidator = (request: AppealRequest) => void;
