/**
 * Shadow Suppression Service for Casual Controls in Point Zero One Digital's financial roguelike game.
 * Maintains internal receipts and ensures silent suppression of extreme anomalies without public callouts.
 */

declare module '*.*' {
  const value: any;
  export default value;
}

export interface AnomalyReceipt {
  anomalyId: string;
  timestamp: Date;
  suppressed: boolean;
}

class ShadowSuppressionService {
  private receipts: AnomalyReceipt[];

  constructor() {
    this.receipts = [];
  }

  public suppressAnomaly(anomalyId: string): void {
    const existingReceipt = this.findReceiptByAnomalyId(anomalyId);

    if (existingReceipt) {
      existingReceipt.suppressed = true;
    } else {
      this.receipts.push({ anomalyId, timestamp: new Date(), suppressed: true });
    }
  }

  private findReceiptByAnomalyId(anomalyId: string): AnomalyReceipt | undefined {
    return this.receipts.find((receipt) => receipt.anomalyId === anomalyId);
  }
}

export default ShadowSuppressionService;
