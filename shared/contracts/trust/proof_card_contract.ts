/**
 * ProofCardContract Interface for handling ProofCardDraft, Stamped payloads and share rendering inputs (OG template data).
 */

export interface ProofCardDraft {
  /** Unique identifier for the proof card draft. */
  id: string;

  /** The user who created the proof card draft. */
  creatorId: string;

  /** The timestamp when the proof card draft was created. */
  creationTime: Date;

  /** The data associated with the proof card draft. */
  data: ProofCardData;
}

export interface ProofCardStamped {
  /** Unique identifier for the stamped proof card. */
  id: string;

  /** The user who stamped the proof card. */
  stamperId: string;

  /** The timestamp when the proof card was stamped. */
  stampTime: Date;

  /** The draft from which this proof card was stamped. */
  draftId: string;
}

export interface ProofCardData {
  /** The name of the proof card. */
  name: string;

  /** The description of the proof card. */
  description: string;

  /** The image URL for the proof card. */
  imageUrl: string;
}
