/**
 * Submission Contract for Creator Economy in Point Zero One Digital's financial roguelike game.
 * Strict TypeScript, no 'any', export all public symbols.
 */

export enum SubmissionState {
  DRAFT = "draft",
  APPROVED = "approved",
  PUBLISHED = "published",
  REJECTED = "rejected"
}

export interface UGCSubmission {
  id: number;
  creatorId: number;
  contentHash: string;
  version: number;
  state: SubmissionState;
}

export function isDraft(submission: UGCSubmission): submission is DraftSubmission {
  return submission.state === SubmissionState.DRAFT;
}

export interface DraftSubmission extends UGCSubmission {
  // Additional properties for draft submissions, if needed
}

export function isApproved(submission: UGCSubmission): submission is ApprovedSubmission {
  return submission.state === SubmissionState.APPROVED;
}

export interface ApprovedSubmission extends UGCSubmission {
  // Additional properties for approved submissions, if needed
}

export function isPublished(submission: UGCSubmission): submission is PublishedSubmission {
  return submission.state === SubmissionState.PUBLISHED;
}

export interface PublishedSubmission extends UGCSubmission {
  // Additional properties for published submissions, if needed
}

export function isRejected(submission: UGCSubmission): submission is RejectedSubmission {
  return submission.state === SubmissionState.REJECTED;
}

export interface RejectedSubmission extends UGCSubmission {
  // Additional properties for rejected submissions, if needed
}
