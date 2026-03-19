
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT CROWD VELOCITY TRACKER
 * FILE: pzo-web/src/engines/chat/social/CrowdVelocityTracker.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Rolling front-end crowd momentum tracker for the sovereign chat runtime.
 *
 * Audience heat describes the current atmosphere.
 * Crowd velocity describes how quickly the atmosphere is moving.
 *
 * This file exists because:
 * - a hot room and a surging room are not the same thing
 * - mood should react differently to a stable 70 than to a 70 racing upward
 * - helpers, crowd reactions, and hater timing all improve when the client can
 *   distinguish acceleration from mere magnitude
 *
 * Design laws
 * -----------
 * - Track velocity as a deterministic rolling signal, not a fuzzy feeling.
 * - Do not change canonical chat state shape. This is a sidecar runtime.
 * - Read only from local runtime truth: current heat, messages, mood, scene,
 *   silence, reputation, and relationship state already present.
 * - Support replay-safe serialization and hydration.
 * - Be cheap enough to run on every local chat tick.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_VISIBLE_CHANNELS,
  type ChatChannelMood,
  type ChatEngineState,
  type ChatMessage,
  type ChatVisibleChannel,
  type Score100,
  type UnixMs,
} from '../types';
import {
  createAudienceHeatEngine,
  type AudienceHeatDerivation,
} from './AudienceHeatEngine';
import {
  createChannelMoodModel,
  type ChannelMoodDerivation,
} from './ChannelMoodModel';

export interface CrowdVelocityClock {
  now(): number;
}

const DEFAULT_CLOCK: CrowdVelocityClock = {
  now: () => Date.now(),
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function asUnixMs(value: number): UnixMs {
  return Math.trunc(Math.max(0, value)) as UnixMs;
}

function avg(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeBody(body: string | undefined): string {
  return (body ?? '').replace(/\s+/g, ' ').trim();
}

function countMatches(body: string, pattern: RegExp): number {
  const matches = body.match(pattern);
  return matches ? matches.length : 0;
}

function countAllCapsWords(body: string): number {
  const tokens = body.split(/\s+/g).filter(Boolean);
  let count = 0;
  for (const token of tokens) {
    const alpha = token.replace(/[^A-Za-z]/g, '');
    if (alpha.length >= 3 && alpha === alpha.toUpperCase()) count += 1;
  }
  return count;
}

export type CrowdVelocityTrend =
  | 'FLAT'
  | 'RISING'
  | 'SURGING'
  | 'SPIKING'
  | 'COOLING'
  | 'COLLAPSING'
  | 'REBOUNDING';

export type CrowdVelocityBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CrowdVelocityAxis = 'HEAT' | 'HYPE' | 'RIDICULE' | 'SCRUTINY' | 'VOLATILITY';
export type CrowdBurstType =
  | 'NONE'
  | 'WITNESS_SWELL'
  | 'RIDICULE_SWARM'
  | 'HYPE_SURGE'
  | 'PREDATORY_SPIKE'
  | 'MOURNFUL_DROP'
  | 'MIXED_BREAKOUT';

export interface CrowdVelocityFrame {
  readonly channelId: ChatVisibleChannel;
  readonly at: UnixMs;
  readonly heat: number;
  readonly hype: number;
  readonly ridicule: number;
  readonly scrutiny: number;
  readonly volatility: number;
  readonly messageCount: number;
  readonly messageIntensity: number;
  readonly witnessPressure: number;
  readonly mood: ChatChannelMood['mood'];
}

export interface CrowdVectorVelocity {
  readonly heatPerSecond: number;
  readonly hypePerSecond: number;
  readonly ridiculePerSecond: number;
  readonly scrutinyPerSecond: number;
  readonly volatilityPerSecond: number;
}

export interface CrowdVectorAcceleration {
  readonly heatPerSecondSq: number;
  readonly hypePerSecondSq: number;
  readonly ridiculePerSecondSq: number;
  readonly scrutinyPerSecondSq: number;
  readonly volatilityPerSecondSq: number;
}

export interface CrowdVelocitySignal {
  readonly channelId: ChatVisibleChannel;
  readonly trend: CrowdVelocityTrend;
  readonly band: CrowdVelocityBand;
  readonly burstType: CrowdBurstType;
  readonly leadAxis: CrowdVelocityAxis;
  readonly leadAxisScore: number;
  readonly speed: number;
  readonly acceleration: number;
  readonly witnessMomentum: number;
  readonly messageBurstDensity: number;
  readonly stability: number;
  readonly reversalRisk: number;
}

export interface CrowdVelocityDerivation {
  readonly channelId: ChatVisibleChannel;
  readonly frame: CrowdVelocityFrame;
  readonly velocity: CrowdVectorVelocity;
  readonly acceleration: CrowdVectorAcceleration;
  readonly signal: CrowdVelocitySignal;
  readonly reasons: readonly string[];
  readonly audience: AudienceHeatDerivation;
  readonly mood: ChannelMoodDerivation;
}

export interface CrowdVelocityPreviewRail {
  readonly label: string;
  readonly value: number;
  readonly severity: CrowdVelocityBand;
  readonly description: string;
}

export interface CrowdVelocityPreview {
  readonly channelId: ChatVisibleChannel;
  readonly signal: CrowdVelocitySignal;
  readonly rails: readonly CrowdVelocityPreviewRail[];
  readonly reasons: readonly string[];
}

export interface CrowdVelocitySnapshot {
  readonly version: 1;
  readonly framesByChannel: Readonly<Record<ChatVisibleChannel, readonly CrowdVelocityFrame[]>>;
  readonly updatedAt: UnixMs;
}

export interface CrowdVelocityConfig {
  readonly clock?: CrowdVelocityClock;
  readonly maxFramesPerChannel?: number;
  readonly minFrameSpacingMs?: number;
  readonly previewMessageWindow?: number;
  readonly speedSpikeThreshold?: number;
  readonly accelerationSpikeThreshold?: number;
  readonly collapseThreshold?: number;
  readonly coolThreshold?: number;
}

export interface CrowdVelocityTrackerApi {
  ingestState(state: ChatEngineState): void;
  deriveChannel(state: ChatEngineState, channelId: ChatVisibleChannel): CrowdVelocityDerivation;
  deriveState(state: ChatEngineState): Readonly<Record<ChatVisibleChannel, CrowdVelocityDerivation>>;
  preview(state: ChatEngineState, channelId: ChatVisibleChannel): CrowdVelocityPreview;
  snapshot(): CrowdVelocitySnapshot;
  hydrate(snapshot: CrowdVelocitySnapshot): void;
  clear(): void;
}

function inferMessageIntensity(messages: readonly ChatMessage[]): number {
  if (!messages.length) return 0;
  const scores = messages.map((message) => {
    const body = normalizeBody(message.body);
    return clamp(
      body.length * 0.16 +
        countMatches(body, /!/g) * 4 +
        countMatches(body, /\?/g) * 2 +
        countAllCapsWords(body) * 5 +
        (message.legend ? 20 : 0) +
        (message.proofHash ? 8 : 0) +
        ((message.readReceipts?.length ?? 0) * 1.5),
      0,
      100,
    );
  });
  return avg(scores);
}

function buildFrameFromState(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
  audience: AudienceHeatDerivation,
  mood: ChannelMoodDerivation,
  previewMessageWindow: number,
  now: number,
): CrowdVelocityFrame {
  const messages = state.messagesByChannel[channelId].slice(-previewMessageWindow);
  return {
    channelId,
    at: asUnixMs(now),
    heat: Number(audience.next.heat),
    hype: Number(audience.next.hype),
    ridicule: Number(audience.next.ridicule),
    scrutiny: Number(audience.next.scrutiny),
    volatility: Number(audience.next.volatility),
    messageCount: messages.length,
    messageIntensity: inferMessageIntensity(messages),
    witnessPressure: audience.summary.witnessPressure,
    mood: mood.next.mood,
  };
}

function shouldAppendFrame(
  existing: readonly CrowdVelocityFrame[],
  candidate: CrowdVelocityFrame,
  minFrameSpacingMs: number,
): boolean {
  const last = existing[existing.length - 1];
  if (!last) return true;
  return candidate.at - last.at >= minFrameSpacingMs;
}

function recentFrames(
  frames: readonly CrowdVelocityFrame[],
  count: number,
): readonly CrowdVelocityFrame[] {
  return frames.slice(Math.max(0, frames.length - count));
}

function derivative(
  previousValue: number,
  nextValue: number,
  deltaMs: number,
): number {
  if (deltaMs <= 0) return 0;
  return ((nextValue - previousValue) / deltaMs) * 1000;
}

function buildVelocity(
  previous: CrowdVelocityFrame | undefined,
  current: CrowdVelocityFrame,
): CrowdVectorVelocity {
  if (!previous) {
    return {
      heatPerSecond: 0,
      hypePerSecond: 0,
      ridiculePerSecond: 0,
      scrutinyPerSecond: 0,
      volatilityPerSecond: 0,
    };
  }

  const deltaMs = Math.max(1, current.at - previous.at);

  return {
    heatPerSecond: derivative(previous.heat, current.heat, deltaMs),
    hypePerSecond: derivative(previous.hype, current.hype, deltaMs),
    ridiculePerSecond: derivative(previous.ridicule, current.ridicule, deltaMs),
    scrutinyPerSecond: derivative(previous.scrutiny, current.scrutiny, deltaMs),
    volatilityPerSecond: derivative(previous.volatility, current.volatility, deltaMs),
  };
}

function buildAcceleration(
  previousVelocity: CrowdVectorVelocity | undefined,
  currentVelocity: CrowdVectorVelocity,
  previousFrame: CrowdVelocityFrame | undefined,
  currentFrame: CrowdVelocityFrame,
): CrowdVectorAcceleration {
  if (!previousVelocity || !previousFrame) {
    return {
      heatPerSecondSq: 0,
      hypePerSecondSq: 0,
      ridiculePerSecondSq: 0,
      scrutinyPerSecondSq: 0,
      volatilityPerSecondSq: 0,
    };
  }

  const deltaMs = Math.max(1, currentFrame.at - previousFrame.at);

  return {
    heatPerSecondSq: derivative(previousVelocity.heatPerSecond, currentVelocity.heatPerSecond, deltaMs),
    hypePerSecondSq: derivative(previousVelocity.hypePerSecond, currentVelocity.hypePerSecond, deltaMs),
    ridiculePerSecondSq: derivative(previousVelocity.ridiculePerSecond, currentVelocity.ridiculePerSecond, deltaMs),
    scrutinyPerSecondSq: derivative(previousVelocity.scrutinyPerSecond, currentVelocity.scrutinyPerSecond, deltaMs),
    volatilityPerSecondSq: derivative(previousVelocity.volatilityPerSecond, currentVelocity.volatilityPerSecond, deltaMs),
  };
}

function speedMagnitude(velocity: CrowdVectorVelocity): number {
  return Math.sqrt(
    velocity.heatPerSecond ** 2 +
      velocity.hypePerSecond ** 2 +
      velocity.ridiculePerSecond ** 2 +
      velocity.scrutinyPerSecond ** 2 +
      velocity.volatilityPerSecond ** 2,
  );
}

function accelerationMagnitude(acceleration: CrowdVectorAcceleration): number {
  return Math.sqrt(
    acceleration.heatPerSecondSq ** 2 +
      acceleration.hypePerSecondSq ** 2 +
      acceleration.ridiculePerSecondSq ** 2 +
      acceleration.scrutinyPerSecondSq ** 2 +
      acceleration.volatilityPerSecondSq ** 2,
  );
}

function leadAxisFromVelocity(velocity: CrowdVectorVelocity): {
  readonly axis: CrowdVelocityAxis;
  readonly score: number;
} {
  const entries: readonly (readonly [CrowdVelocityAxis, number])[] = [
    ['HEAT', Math.abs(velocity.heatPerSecond)],
    ['HYPE', Math.abs(velocity.hypePerSecond)],
    ['RIDICULE', Math.abs(velocity.ridiculePerSecond)],
    ['SCRUTINY', Math.abs(velocity.scrutinyPerSecond)],
    ['VOLATILITY', Math.abs(velocity.volatilityPerSecond)],
  ] as const;

  return [...entries].sort((a, b) => b[1] - a[1])[0] ?? ['HEAT', 0];
}

function classifyBand(score: number): CrowdVelocityBand {
  if (score >= 80) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 22) return 'MEDIUM';
  return 'LOW';
}

function classifyBurstType(
  frame: CrowdVelocityFrame,
  velocity: CrowdVectorVelocity,
  mood: ChannelMoodDerivation,
): CrowdBurstType {
  if (Math.abs(velocity.ridiculePerSecond) >= Math.abs(velocity.hypePerSecond) &&
      velocity.ridiculePerSecond >= 10) {
    return 'RIDICULE_SWARM';
  }
  if (velocity.hypePerSecond >= 10) {
    return 'HYPE_SURGE';
  }
  if (frame.mood === 'PREDATORY' && velocity.scrutinyPerSecond >= 6) {
    return 'PREDATORY_SPIKE';
  }
  if (frame.mood === 'MOURNFUL' && velocity.heatPerSecond <= -8) {
    return 'MOURNFUL_DROP';
  }
  if (frame.witnessPressure >= 60 && velocity.heatPerSecond >= 6) {
    return 'WITNESS_SWELL';
  }
  const mixedMagnitude =
    Math.abs(velocity.heatPerSecond) +
    Math.abs(velocity.hypePerSecond) +
    Math.abs(velocity.ridiculePerSecond) +
    Math.abs(velocity.scrutinyPerSecond);

  if (mixedMagnitude >= 36 && mood.summary.transitionRisk !== 'LOW') {
    return 'MIXED_BREAKOUT';
  }
  return 'NONE';
}

function classifyTrend(
  frame: CrowdVelocityFrame,
  velocity: CrowdVectorVelocity,
  acceleration: CrowdVectorAcceleration,
  speed: number,
  collapseThreshold: number,
  coolThreshold: number,
): CrowdVelocityTrend {
  const heatV = velocity.heatPerSecond;
  const hypeV = velocity.hypePerSecond;
  const ridiculeV = velocity.ridiculePerSecond;
  const accel = accelerationMagnitude(acceleration);

  if (heatV <= -collapseThreshold || (frame.mood === 'MOURNFUL' && heatV <= -coolThreshold * 1.2)) {
    return 'COLLAPSING';
  }
  if (speed >= 16 && accel >= 12 && (hypeV >= 6 || ridiculeV >= 6)) {
    return 'SPIKING';
  }
  if (heatV >= 8 || (speed >= 11 && accel >= 5)) {
    return 'SURGING';
  }
  if (heatV >= 2 || hypeV >= 2 || ridiculeV >= 2) {
    return 'RISING';
  }
  if (heatV <= -coolThreshold || hypeV <= -coolThreshold * 0.8) {
    return 'COOLING';
  }
  if (acceleration.heatPerSecondSq >= 5 && frame.heat <= 38) {
    return 'REBOUNDING';
  }
  return 'FLAT';
}

function buildReasons(
  frame: CrowdVelocityFrame,
  velocity: CrowdVectorVelocity,
  acceleration: CrowdVectorAcceleration,
  signal: CrowdVelocitySignal,
): readonly string[] {
  const reasons: string[] = [];

  reasons.push(`${frame.channelId.toLowerCase()} crowd trend is ${signal.trend.toLowerCase()}`);
  reasons.push(`lead axis ${signal.leadAxis.toLowerCase()} moving at ${signal.leadAxisScore.toFixed(2)} / sec`);
  reasons.push(`witness momentum ${signal.witnessMomentum.toFixed(1)}`);
  reasons.push(`message burst density ${signal.messageBurstDensity.toFixed(1)}`);

  if (signal.burstType !== 'NONE') {
    reasons.push(`burst type ${signal.burstType.toLowerCase().replace(/_/g, ' ')}`);
  }

  if (frame.mood === 'HOSTILE' && velocity.ridiculePerSecond > 0) {
    reasons.push('hostile weather is accelerating ridicule flow');
  }
  if (frame.mood === 'ECSTATIC' && velocity.hypePerSecond > 0) {
    reasons.push('ecstatic weather is amplifying hype momentum');
  }
  if (frame.mood === 'PREDATORY' && velocity.scrutinyPerSecond > 0) {
    reasons.push('predatory weather is thickening scrutiny');
  }
  if (frame.mood === 'MOURNFUL' && velocity.heatPerSecond < 0) {
    reasons.push('mournful weather is suppressing heat');
  }

  if (accelerationMagnitude(acceleration) >= 10) {
    reasons.push('acceleration is high enough to justify pre-emptive scene planning');
  }

  return reasons;
}

export class CrowdVelocityTracker implements CrowdVelocityTrackerApi {
  private readonly clock: CrowdVelocityClock;
  private readonly maxFramesPerChannel: number;
  private readonly minFrameSpacingMs: number;
  private readonly previewMessageWindow: number;
  private readonly speedSpikeThreshold: number;
  private readonly accelerationSpikeThreshold: number;
  private readonly collapseThreshold: number;
  private readonly coolThreshold: number;
  private readonly audienceEngine = createAudienceHeatEngine();
  private readonly moodModel = createChannelMoodModel();
  private readonly framesByChannel = new Map<ChatVisibleChannel, CrowdVelocityFrame[]>();

  public constructor(config: CrowdVelocityConfig = {}) {
    this.clock = config.clock ?? DEFAULT_CLOCK;
    this.maxFramesPerChannel = config.maxFramesPerChannel ?? 120;
    this.minFrameSpacingMs = config.minFrameSpacingMs ?? 750;
    this.previewMessageWindow = config.previewMessageWindow ?? 10;
    this.speedSpikeThreshold = config.speedSpikeThreshold ?? 14;
    this.accelerationSpikeThreshold = config.accelerationSpikeThreshold ?? 10;
    this.collapseThreshold = config.collapseThreshold ?? 8;
    this.coolThreshold = config.coolThreshold ?? 4;
  }

  public clear(): void {
    this.framesByChannel.clear();
  }

  public hydrate(snapshot: CrowdVelocitySnapshot): void {
    this.framesByChannel.clear();
    for (const channelId of CHAT_VISIBLE_CHANNELS) {
      this.framesByChannel.set(channelId, [...(snapshot.framesByChannel[channelId] ?? [])]);
    }
  }

  public snapshot(): CrowdVelocitySnapshot {
    const entries = CHAT_VISIBLE_CHANNELS.map((channelId) => [
      channelId,
      Object.freeze([...(this.framesByChannel.get(channelId) ?? [])]),
    ]) as readonly (readonly [ChatVisibleChannel, readonly CrowdVelocityFrame[]])[];

    return {
      version: 1,
      framesByChannel: Object.freeze(
        Object.fromEntries(entries) as Record<ChatVisibleChannel, readonly CrowdVelocityFrame[]>,
      ),
      updatedAt: asUnixMs(this.clock.now()),
    };
  }

  public ingestState(state: ChatEngineState): void {
    const now = this.clock.now();

    for (const channelId of CHAT_VISIBLE_CHANNELS) {
      const audience = this.audienceEngine.deriveChannelHeat(state, channelId);
      const mood = this.moodModel.deriveChannelMood(state, channelId);
      const frame = buildFrameFromState(
        state,
        channelId,
        audience,
        mood,
        this.previewMessageWindow,
        now,
      );

      const existing = this.framesByChannel.get(channelId) ?? [];
      if (!shouldAppendFrame(existing, frame, this.minFrameSpacingMs)) {
        continue;
      }

      const next = [...existing, frame];
      if (next.length > this.maxFramesPerChannel) {
        next.splice(0, next.length - this.maxFramesPerChannel);
      }
      this.framesByChannel.set(channelId, next);
    }
  }

  public deriveChannel(
    state: ChatEngineState,
    channelId: ChatVisibleChannel,
  ): CrowdVelocityDerivation {
    const now = this.clock.now();
    const audience = this.audienceEngine.deriveChannelHeat(state, channelId);
    const mood = this.moodModel.deriveChannelMood(state, channelId);
    const frame = buildFrameFromState(
      state,
      channelId,
      audience,
      mood,
      this.previewMessageWindow,
      now,
    );

    const historical = this.framesByChannel.get(channelId) ?? [];
    const previousFrame = historical[historical.length - 1];
    const previousPreviousFrame = historical[historical.length - 2];

    const velocity = buildVelocity(previousFrame, frame);
    const previousVelocity = previousFrame && previousPreviousFrame
      ? buildVelocity(previousPreviousFrame, previousFrame)
      : undefined;
    const acceleration = buildAcceleration(previousVelocity, velocity, previousFrame, frame);

    const speed = Math.sqrt(
      velocity.heatPerSecond ** 2 +
        velocity.hypePerSecond ** 2 +
        velocity.ridiculePerSecond ** 2 +
        velocity.scrutinyPerSecond ** 2 +
        velocity.volatilityPerSecond ** 2,
    );
    const accel = Math.sqrt(
      acceleration.heatPerSecondSq ** 2 +
        acceleration.hypePerSecondSq ** 2 +
        acceleration.ridiculePerSecondSq ** 2 +
        acceleration.scrutinyPerSecondSq ** 2 +
        acceleration.volatilityPerSecondSq ** 2,
    );
    const leadAxis = leadAxisFromVelocity(velocity);
    const recent = recentFrames([...historical, frame], 8);

    const messageBurstDensity = clamp(
      avg(recent.map((item) => item.messageCount)) * 6 +
        avg(recent.map((item) => item.messageIntensity)) * 0.38,
      0,
      100,
    );

    const witnessMomentum = clamp(
      avg(recent.map((item) => item.witnessPressure)) +
        velocity.heatPerSecond * 0.8 +
        velocity.scrutinyPerSecond * 0.6,
      0,
      100,
    );

    const stability = clamp(
      100 -
        avg(recent.map((item) => item.volatility)) * 0.62 -
        speed * 2.2 -
        accel * 1.3,
      0,
      100,
    );

    const reversalRisk = clamp(
      avg(recent.map((item) => item.volatility)) * 0.45 +
        Math.abs(velocity.heatPerSecond) * 2.2 +
        Math.abs(acceleration.heatPerSecondSq) * 1.5,
      0,
      100,
    );

    const trend = classifyTrend(
      frame,
      velocity,
      acceleration,
      speed,
      this.collapseThreshold,
      this.coolThreshold,
    );

    const band = classifyBand(
      clamp(
        speed * 3.1 +
          accel * 2.4 +
          messageBurstDensity * 0.26 +
          witnessMomentum * 0.22 +
          (trend === 'SPIKING' ? 16 : trend === 'SURGING' ? 9 : trend === 'COLLAPSING' ? 11 : 0),
        0,
        100,
      ),
    );

    const signal: CrowdVelocitySignal = {
      channelId,
      trend,
      band,
      burstType: classifyBurstType(frame, velocity, mood),
      leadAxis: leadAxis.axis,
      leadAxisScore: leadAxis.score,
      speed,
      acceleration: accel,
      witnessMomentum,
      messageBurstDensity,
      stability,
      reversalRisk,
    };

    return {
      channelId,
      frame,
      velocity,
      acceleration,
      signal,
      reasons: buildReasons(frame, velocity, acceleration, signal),
      audience,
      mood,
    };
  }

  public deriveState(
    state: ChatEngineState,
  ): Readonly<Record<ChatVisibleChannel, CrowdVelocityDerivation>> {
    const entries = CHAT_VISIBLE_CHANNELS.map((channelId) => [
      channelId,
      this.deriveChannel(state, channelId),
    ]) as readonly (readonly [ChatVisibleChannel, CrowdVelocityDerivation])[];

    return Object.freeze(
      Object.fromEntries(entries) as Record<ChatVisibleChannel, CrowdVelocityDerivation>,
    );
  }

  public preview(
    state: ChatEngineState,
    channelId: ChatVisibleChannel,
  ): CrowdVelocityPreview {
    const derivation = this.deriveChannel(state, channelId);

    const rails: CrowdVelocityPreviewRail[] = [
      { label: 'Speed', value: derivation.signal.speed, severity: classifyBand(derivation.signal.speed * 4.2), description: 'overall vector speed' },
      { label: 'Acceleration', value: derivation.signal.acceleration, severity: classifyBand(derivation.signal.acceleration * 4.8), description: 'change in crowd speed' },
      { label: 'Witness momentum', value: derivation.signal.witnessMomentum, severity: classifyBand(derivation.signal.witnessMomentum), description: 'pressure from visible witnesses' },
      { label: 'Message burst', value: derivation.signal.messageBurstDensity, severity: classifyBand(derivation.signal.messageBurstDensity), description: 'message count and intensity density' },
      {
        label: 'Stability',
        value: derivation.signal.stability,
        severity:
          derivation.signal.stability >= 70
            ? 'LOW'
            : derivation.signal.stability >= 45
              ? 'MEDIUM'
              : derivation.signal.stability >= 25
                ? 'HIGH'
                : 'CRITICAL',
        description: 'lower means more unstable',
      },
      { label: 'Reversal risk', value: derivation.signal.reversalRisk, severity: classifyBand(derivation.signal.reversalRisk), description: 'likelihood of sharp mood inversion' },
    ];

    return {
      channelId,
      signal: derivation.signal,
      rails,
      reasons: derivation.reasons,
    };
  }
}

export function createCrowdVelocityTracker(
  config: CrowdVelocityConfig = {},
): CrowdVelocityTracker {
  return new CrowdVelocityTracker(config);
}

export function deriveCrowdVelocity(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
  config: CrowdVelocityConfig = {},
): CrowdVelocityDerivation {
  return createCrowdVelocityTracker(config).deriveChannel(state, channelId);
}

export function deriveCrowdVelocityState(
  state: ChatEngineState,
  config: CrowdVelocityConfig = {},
): Readonly<Record<ChatVisibleChannel, CrowdVelocityDerivation>> {
  return createCrowdVelocityTracker(config).deriveState(state);
}

export function previewCrowdVelocity(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
  config: CrowdVelocityConfig = {},
): CrowdVelocityPreview {
  return createCrowdVelocityTracker(config).preview(state, channelId);
}

export interface CrowdVelocityDiagnostic {
  readonly channelId: ChatVisibleChannel;
  readonly trend: CrowdVelocityTrend;
  readonly band: CrowdVelocityBand;
  readonly burstType: CrowdBurstType;
  readonly leadAxis: CrowdVelocityAxis;
  readonly leadAxisScore: number;
  readonly speed: number;
  readonly acceleration: number;
  readonly witnessMomentum: number;
  readonly stability: number;
  readonly reversalRisk: number;
  readonly mood: ChatChannelMood['mood'];
}

export function buildCrowdVelocityDiagnostics(
  state: ChatEngineState,
  tracker: CrowdVelocityTracker = createCrowdVelocityTracker(),
): readonly CrowdVelocityDiagnostic[] {
  return CHAT_VISIBLE_CHANNELS.map((channelId) => {
    const derivation = tracker.deriveChannel(state, channelId);
    return {
      channelId,
      trend: derivation.signal.trend,
      band: derivation.signal.band,
      burstType: derivation.signal.burstType,
      leadAxis: derivation.signal.leadAxis,
      leadAxisScore: derivation.signal.leadAxisScore,
      speed: derivation.signal.speed,
      acceleration: derivation.signal.acceleration,
      witnessMomentum: derivation.signal.witnessMomentum,
      stability: derivation.signal.stability,
      reversalRisk: derivation.signal.reversalRisk,
      mood: derivation.frame.mood,
    };
  });
}

export function describeCrowdTrend(trend: CrowdVelocityTrend): string {
  switch (trend) {
    case 'SPIKING':
      return 'room pressure is breaking upward rapidly';
    case 'SURGING':
      return 'room pressure is climbing with conviction';
    case 'RISING':
      return 'room pressure is increasing';
    case 'COOLING':
      return 'room pressure is cooling';
    case 'COLLAPSING':
      return 'room pressure is dropping hard';
    case 'REBOUNDING':
      return 'room pressure is recovering after a drop';
    case 'FLAT':
    default:
      return 'room pressure is mostly flat';
  }
}
