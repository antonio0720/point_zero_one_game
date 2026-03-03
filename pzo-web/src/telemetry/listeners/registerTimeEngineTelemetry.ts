// pzo-web/src/telemetry/listeners/registerTimeEngineTelemetry.ts

export const timeEngineMetrics = new Map<number, unknown>();

// Stub: replace analyticsData with real import when aggregates module exists
const analyticsData = new Map<string, unknown>();

export function trackDecisionWindowSLATrigger(): void {
  const currentSessionData = analyticsData.get('sessionTelemetry');
  if (currentSessionData) {
    timeEngineMetrics.set(timeEngineMetrics.size, computeSLAMetrics(currentSessionData));
  }
}

interface SessionData {
  autoResolvedCount: number;
  totalDecisions: number;
  holdUsedCount: number;
  openTime: number;
  resolveTime: number;
  tierAtOpen?: string;
  tierAtExpiry?: string;
}

function computeSLAMetrics(sessionData: unknown): unknown {
  const s = sessionData as SessionData;
  const openToResolveLatency = calculateOpenToResolveLatency(s);
  const autoResolvedPercentage = (s.autoResolvedCount / s.totalDecisions * 100).toFixed(2);
  const holdUsedPercentage = (s.holdUsedCount / s.totalDecisions * 100).toFixed(2);
  return {
    openToResolveLatency,
    autoResolvedPercentage,
    holdUsedPercentage,
    tierAtOpen: s.tierAtOpen ?? null,
    tierAtExpiry: s.tierAtExpiry ?? null,
  };
}

function calculateOpenToResolveLatency(sessionData: SessionData): number {
  return sessionData.openTime - sessionData.resolveTime;
}
