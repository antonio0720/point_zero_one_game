import { createHash } from 'node:crypto';

export interface AfterAutopsyInsight {
  id: string;
  value?: string;
  output?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface StageInsightInput {
  stage: string;
  insights: AfterAutopsyInsight[];
}

export interface StagePayloadInput {
  id: string;
  insights?: AfterAutopsyInsight[];
  failures?: string[];
  metrics?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface AfterAutopsyStagePayload {
  insightCount: number;
  primaryFailure: string | null;
  metrics: Record<string, number>;
  highlights: string[];
  metadata: Record<string, unknown>;
}

export interface AfterAutopsyRunMetrics {
  liquidity?: number;
  debt?: number;
  timerFailures?: number;
  missedPayments?: number;
  shieldBreaks?: number;
  opportunityMisses?: number;
  overextensionEvents?: number;
  panicSells?: number;
}

export interface AfterAutopsyRunReport {
  runId: string;
  playerId: string;
  stage: string;
  metrics?: AfterAutopsyRunMetrics;
  stages?: StagePayloadInput[];
  priorRun?: Pick<AfterAutopsyRunReport, 'runId' | 'metrics' | 'stage'>;
}

export interface AfterAutopsyPacket {
  runId: string;
  playerId: string;
  causeOfDeath: 'liquidity' | 'debt' | 'timer' | 'shield' | 'discipline' | 'volatility';
  severityScore: number;
  summary: string;
  actionableInsight: string;
  singleInsight: {
    id: string;
    output: string;
  };
  stagePayloads: Record<string, AfterAutopsyStagePayload>;
  deltaHighlights: Array<{
    key: string;
    direction: 'up' | 'down' | 'flat';
    delta: number;
  }>;
  receiptHash: string;
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class AfterAutopsyImpl {
  public singleInsightOutput(input: StageInsightInput): {
    stage: string;
    insights: Array<{ id: string; output: string }>;
  } {
    return {
      stage: input.stage,
      insights: (input.insights ?? []).map((insight) => ({
        id: insight.id,
        output: insight.output ?? insight.value ?? '',
      })),
    };
  }

  public stageSpecificPayloads(input: { stages: StagePayloadInput[] }): Record<string, AfterAutopsyStagePayload> {
    const output: Record<string, AfterAutopsyStagePayload> = {};

    for (const stage of input.stages ?? []) {
      const highlights: string[] = [];
      const failures = stage.failures ?? [];
      const metrics = stage.metrics ?? {};
      const insightCount = stage.insights?.length ?? 0;

      if (failures.length > 0) {
        highlights.push(`Primary failure: ${failures[0]}`);
      }

      const sortedMetrics = Object.entries(metrics)
        .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
        .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
        .slice(0, 3);

      for (const [metricKey, metricValue] of sortedMetrics) {
        highlights.push(`${metricKey}: ${metricValue}`);
      }

      output[stage.id] = {
        insightCount,
        primaryFailure: failures[0] ?? null,
        metrics,
        highlights,
        metadata: { ...(stage.metadata ?? {}) },
      };
    }

    return output;
  }

  public buildAfterAutopsy(report: AfterAutopsyRunReport): AfterAutopsyPacket {
    const scores = this.computeRootCauseScores(report.metrics ?? {});
    const causeOfDeath = this.pickCauseOfDeath(scores);
    const severityScore = clamp(Math.round(scores[causeOfDeath]), 0, 100);
    const actionableInsight = this.buildActionableInsight(causeOfDeath, report.metrics ?? {});
    const stagePayloads = this.stageSpecificPayloads({
      stages: report.stages ?? [
        {
          id: report.stage,
          metrics: report.metrics as Record<string, number>,
          failures: [causeOfDeath],
          insights: [
            {
              id: `${causeOfDeath}_insight`,
              value: actionableInsight,
            },
          ],
        },
      ],
    });

    const singleInsight = this.singleInsightOutput({
      stage: report.stage,
      insights: [
        {
          id: `${causeOfDeath}_insight`,
          value: actionableInsight,
        },
      ],
    }).insights[0];

    const packet: AfterAutopsyPacket = {
      runId: report.runId,
      playerId: report.playerId,
      causeOfDeath,
      severityScore,
      summary: this.buildSummary(causeOfDeath, severityScore),
      actionableInsight,
      singleInsight,
      stagePayloads,
      deltaHighlights: this.buildDeltaHighlights(report.metrics ?? {}, report.priorRun?.metrics ?? {}),
      receiptHash: '',
    };

    packet.receiptHash = stableHash(packet);
    return packet;
  }

  private computeRootCauseScores(
    metrics: AfterAutopsyRunMetrics,
  ): Record<AfterAutopsyPacket['causeOfDeath'], number> {
    const liquidity =
      Math.max(0, 100 - toNumber(metrics.liquidity)) +
      toNumber(metrics.missedPayments) * 12 +
      toNumber(metrics.opportunityMisses) * 2;

    const debt =
      Math.max(0, toNumber(metrics.debt)) * 0.02 +
      toNumber(metrics.missedPayments) * 18;

    const timer = toNumber(metrics.timerFailures) * 22 + toNumber(metrics.panicSells) * 6;

    const shield = toNumber(metrics.shieldBreaks) * 20 + toNumber(metrics.overextensionEvents) * 4;

    const discipline =
      toNumber(metrics.overextensionEvents) * 14 + toNumber(metrics.panicSells) * 16;

    const volatility =
      toNumber(metrics.opportunityMisses) * 5 +
      toNumber(metrics.panicSells) * 10 +
      toNumber(metrics.shieldBreaks) * 4;

    return {
      liquidity,
      debt,
      timer,
      shield,
      discipline,
      volatility,
    };
  }

  private pickCauseOfDeath(
    scores: Record<AfterAutopsyPacket['causeOfDeath'], number>,
  ): AfterAutopsyPacket['causeOfDeath'] {
    return (Object.entries(scores).sort((left, right) => right[1] - left[1])[0]?.[0] ??
      'liquidity') as AfterAutopsyPacket['causeOfDeath'];
  }

  private buildActionableInsight(
    causeOfDeath: AfterAutopsyPacket['causeOfDeath'],
    metrics: AfterAutopsyRunMetrics,
  ): string {
    switch (causeOfDeath) {
      case 'liquidity':
        return 'Stabilize cash first: remove one risky spend, protect the next payment window, and rebuild buffer before chasing upside.';
      case 'debt':
        return 'Prioritize debt compression: convert the next profitable action into repayment and avoid opening any new liabilities until missed payments stop.';
      case 'timer':
        return `Timer pressure killed the run. Cut action count on the opener and pre-commit the first two decisions before the window starts.`;
      case 'shield':
        return 'You ran out of protection before the run could recover. Hold one defensive answer in reserve and stop spending shield on non-fatal pressure.';
      case 'discipline':
        return 'Execution drift, not information, broke the run. Reduce impulse actions and require one cashflow-positive move before any speculative move.';
      case 'volatility':
      default:
        return 'Volatility outran structure. Narrow your lane, ignore noisy upside, and only press when the edge is clear and repeatable.';
    }
  }

  private buildSummary(
    causeOfDeath: AfterAutopsyPacket['causeOfDeath'],
    severityScore: number,
  ): string {
    return `Primary failure domain: ${causeOfDeath}. Severity ${severityScore}/100.`;
  }

  private buildDeltaHighlights(
    current: AfterAutopsyRunMetrics,
    previous: AfterAutopsyRunMetrics,
  ): Array<{ key: string; direction: 'up' | 'down' | 'flat'; delta: number }> {
    const keys = new Set<string>([
      ...Object.keys(current ?? {}),
      ...Object.keys(previous ?? {}),
    ]);

    return [...keys]
      .map((key) => {
        const delta = toNumber((current as Record<string, unknown>)[key]) - toNumber((previous as Record<string, unknown>)[key]);
        const direction: 'up' | 'down' | 'flat' = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
        return {
          key,
          direction,
          delta,
        };
      })
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
      .slice(0, 6);
  }
}

export default AfterAutopsyImpl;
