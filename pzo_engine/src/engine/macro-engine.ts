// @ts-check

export enum Phase {
  EXPANSION = 'EXPANSION',
  PEAK = 'PEAK',
  CONTRACTION = 'CONTRACTION',
  TROUGH = 'TROUGH'
}

export interface MacroEngineConfig {
  inflation: number;
  creditTightness: number;
  phase: Phase;
  mlEnabled?: boolean;
}

const ML_ENABLED = false;

function calculateErosionMeterValue(inflation: number, creditTightness: number): number {
  if (ML_ENABLED) {
    // TODO: implement erosion meter value calculation using ML model
    return Math.random(); // placeholder for now
  } else {
    const baseValue = inflation + creditTightness;
    return Math.min(Math.max(baseValue, 0), 1);
  }
}

function calculateEndOfRotationCashDecay(inflation: number): number {
  if (inflation < 3) {
    return 0.05 * inflation;
  } else if (inflation < 4) {
    return 0.15 + 0.02 * (inflation - 3);
  } else {
    return 0.25 + 0.01 * (inflation - 4);
  }
}

function calculateAuditHash(inflation: number, creditTightness: number): string {
  const hash = crypto.createHash('sha256');
  hash.update(`${inflation},${creditTightness}`);
  return hash.digest('hex');
}

export function macroEngine(
  inflation: number,
  creditTightness: number,
  phase: Phase
): { erosionMeterValue: number; endOfRotationCashDecay: number; auditHash: string } {
  const erosionMeterValue = calculateErosionMeterValue(inflation, creditTightness);
  const endOfRotationCashDecay = calculateEndOfRotationCashDecay(inflation);
  const auditHash = calculateAuditHash(inflation, creditTightness);

  return {
    erosionMeterValue,
    endOfRotationCashDecay,
    auditHash
  };
}
