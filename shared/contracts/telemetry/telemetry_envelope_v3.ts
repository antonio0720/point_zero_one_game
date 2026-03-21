/**
 * TelemetryEnvelopeV3 contract for Point Zero One Digital's financial roguelike game.
 */

export interface TelemetryEnvelopeV3 {
  idempotencyKey: string;
  runId: string;
  userOrGuestId: string;
  tenant: string;
  timestamps: {
    createdAt: Date;
    updatedAt: Date;
  };
  schemaVersion: number;
}
