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
```

Please note that this TypeScript file only defines the interfaces and type guards for the UGCSubmission, its states, and transitions. The actual implementation of the game engine or replay determinism is not included here.

Regarding SQL, YAML/JSON, Bash, and Terraform, they are not provided as they are not part of the specific request in this example.
