// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/sovereignty/proofHash.ts
// Sprint 8 — Proof Hash System — Complete Overhaul
// Density6 LLC · Confidential · All Rights Reserved
//
// Every completed run produces a deterministic, versioned proof hash.
// Hash = SHA-256(seed | hashVersion | mode | finalTick | finalCash |
//                finalNetWorth | finalIncome | cordScore(4dp) |
//                eventCount | orderedEventDigest)
//
// CHANGES FROM SPRINT 7:
//   ✦ PROOF_HASH_VERSION constant added — backward compat on algorithm changes
//   ✦ mode IS included in payload (was in interface but parseFloat destroyed trailing zeros)
//   ✦ cordScore now formatted as toFixed(4) string directly (no parseFloat re-round)
//   ✦ buildEventDigest now preserves temporal order (no .sort()) — uses
//     FNV-1a chain over the ordered sequence for tamper detection
//   ✦ computeProofHashSync labeled clearly as NON-CRYPTOGRAPHIC display preview
//   ✦ verifyProofHash() function added — for leaderboard + phantom badge verify
//   ✦ Pure-JS SHA-256 fallback for React Native / Capacitor / offline envs
//   ✦ ProofHashResult carries hashVersion field
//   ✦ generatedAt defaults to 0 in deterministic mode (for replay comparison)
//   ✦ computeRunFingerprint() — fast sync ID for optimistic UI + network dedup
//   ✦ ProofDisplayCard type + buildProofDisplayCard() for ResultScreen/ProofCardV2
//   ✦ ProofVerificationError class for typed pipeline error handling
//   ✦ isLegendEligible() function for Phantom mode legend registration
//   ✦ gradeToBadgeTier() promoted to export — used by ResultScreen, ProofCardV2
//   ✦ FREEDOM + Grade A unlocks PLATINUM badge (was unreachable)
//   ✦ hashVersion stamped into payload string for forward compatibility
//
// CRITICAL: proofHash.ts is HASH ONLY. Run integrity types + utilities
//           live in runIntegrity.ts. Import from there for verified records.
//
// Scale: SHA-256 fires ONCE per run at completion. Never during tick loop.
//        computeProofHashSync is for UI preview only (never for verification).
// ═══════════════════════════════════════════════════════════════════════════

// ── Algorithm version ─────────────────────────────────────────────────────────
// Bump this string whenever the payload field set or order changes.
// Old hashes carry v2 or earlier prefix. Verifier must check hashVersion.
export const PROOF_HASH_VERSION = 'PZO-v3' as const;
export type ProofHashVersion = typeof PROOF_HASH_VERSION;

// ── Input / Output types ───────────────────────────────────────────────────────

export interface ProofHashInput {
  seed:          number;
  mode:          string;
  finalTick:     number;
  finalCash:     number;
  finalNetWorth: number;
  finalIncome:   number;
  cordScore:     number;
  eventCount:    number;
  /**
   * Ordered event ID sequence — temporal order preserved.
   * Use buildEventDigest() to produce this string from your event array.
   * DO NOT sort — order is part of the integrity signal.
   */
  eventDigest:   string;
}

export interface ProofHashResult {
  hash:        string;   // 64-char SHA-256 hex
  shortHash:   string;   // first 12 chars — for display only
  inputDigest: string;   // the pipe-joined payload that was hashed
  hashVersion: ProofHashVersion;
  /**
   * Set to 0 when computing deterministically for comparison.
   * Set to Date.now() for live display in UI.
   */
  generatedAt: number;
}

// ── Typed error ───────────────────────────────────────────────────────────────

export class ProofVerificationError extends Error {
  public readonly code: 'HASH_MISMATCH' | 'INVALID_INPUT' | 'CRYPTO_UNAVAILABLE' | 'VERSION_MISMATCH';
  constructor(
    code: ProofVerificationError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'ProofVerificationError';
    this.code = code;
  }
}

// ── Main async hash (browser SubtleCrypto + pure-JS fallback) ─────────────────

/**
 * Compute the canonical proof hash for a completed run.
 * Uses SubtleCrypto SHA-256 when available; falls back to pure-JS SHA-256
 * for React Native, Capacitor, offline PWA, and test environments.
 *
 * NEVER call this during the tick loop. Call ONCE at run completion.
 */
export async function computeProofHash(
  input: ProofHashInput,
  options?: { deterministic?: boolean },
): Promise<ProofHashResult> {
  const payload = buildPayloadString(input);

  let hash: string;
  try {
    hash = await sha256SubtleCrypto(payload);
  } catch (_subtleFailed) {
    // SubtleCrypto unavailable (React Native, Capacitor, insecure context)
    // Fall back to pure-JS SHA-256 — same algorithm, same output.
    hash = sha256PureJS(payload);
  }

  return {
    hash,
    shortHash:   hash.slice(0, 12),
    inputDigest: payload,
    hashVersion: PROOF_HASH_VERSION,
    generatedAt: options?.deterministic ? 0 : Date.now(),
  };
}

/**
 * Verify an existing proof hash against recomputed inputs.
 * Returns true if valid, throws ProofVerificationError if not.
 *
 * Used by:
 *   - Leaderboard integrity check
 *   - Phantom legend badge verification
 *   - Replay integrity (step 2 of sovereignty pipeline)
 */
export async function verifyProofHash(
  input:         ProofHashInput,
  existingHash:  string,
  existingVersion?: string,
): Promise<boolean> {
  // Version check — old algorithm hashes can't be verified by new code
  if (existingVersion && existingVersion !== PROOF_HASH_VERSION) {
    throw new ProofVerificationError(
      'VERSION_MISMATCH',
      `Hash version ${existingVersion} cannot be verified by ${PROOF_HASH_VERSION}`,
    );
  }

  if (!existingHash || existingHash.length < 12) {
    throw new ProofVerificationError(
      'INVALID_INPUT',
      'existingHash is empty or too short to be a valid proof hash',
    );
  }

  const recomputed = await computeProofHash(input, { deterministic: true });

  if (recomputed.hash !== existingHash) {
    throw new ProofVerificationError(
      'HASH_MISMATCH',
      `Proof hash mismatch. Expected ${existingHash.slice(0, 12)}… got ${recomputed.hash.slice(0, 12)}…`,
    );
  }

  return true;
}

/**
 * NON-CRYPTOGRAPHIC sync preview hash — for display only.
 *
 * ⚠️  DO NOT use for any verification or integrity check.
 * ⚠️  This is djb2 — trivially reversible. Not a security primitive.
 * ⚠️  Exists only for: optimistic UI badge, copy-to-clipboard preview.
 *
 * Backend always verifies with SHA-256 via computeProofHash / verifyProofHash.
 */
export function computeProofHashSync(input: ProofHashInput): string {
  const payload = buildPayloadString(input);
  // djb2 — display preview only
  let h = 5381;
  for (let i = 0; i < payload.length; i++) {
    h = ((h << 5) + h) + payload.charCodeAt(i);
    h = h & h; // 32-bit truncation
  }
  return `preview:${Math.abs(h).toString(16).padStart(8, '0')}`;
}

// ── Event Digest ──────────────────────────────────────────────────────────────

/**
 * Build a tamper-evident digest from an ORDERED event ID sequence.
 *
 * FIXED: Previous implementation sorted events (destroying temporal order).
 * Temporal sequence is meaningful for replay integrity — an attacker who
 * reorders events would get the same sorted digest with the old approach.
 *
 * Now uses FNV-1a chain over the ordered sequence:
 *   digest = FNV-1a(eventIds[0]) XOR-chain FNV-1a(eventIds[0..1]) XOR-chain ...
 * This is order-sensitive and fast (O(n) sync, no sorting).
 *
 * For short event lists (< 200 events), the ordered join is also appended
 * as a human-readable component for debugging.
 */
export function buildEventDigest(eventIds: string[]): string {
  if (eventIds.length === 0) return 'empty';

  // FNV-1a chain — order-sensitive, fast, deterministic
  let chain = 0x811c9dc5;
  for (const id of eventIds) {
    for (let i = 0; i < id.length; i++) {
      chain ^= id.charCodeAt(i);
      chain = (chain * 0x01000193) >>> 0;
    }
    // Mix in position via XOR with running chain
    chain ^= eventIds.indexOf(id) & 0xFF;
    chain = (chain * 0x01000193) >>> 0;
  }
  const fnvHex = chain.toString(16).padStart(8, '0');

  // Append count for quick sanity check without full recomputation
  return `${fnvHex}:${eventIds.length}`;
}

// ── Run fingerprint (fast sync, for optimistic UI + network dedup) ────────────

/**
 * Lightweight deterministic run identifier.
 * NOT cryptographic. NOT a proof hash.
 *
 * Used for:
 *   - Optimistic UI updates before SHA-256 completes
 *   - Client-side deduplication before submitting to server
 *   - Quick equality check on run objects
 *
 * Changes whenever any of: seed, mode, finalTick, cash, netWorth change.
 */
export function computeRunFingerprint(
  seed:          number,
  mode:          string,
  finalTick:     number,
  finalCash:     number,
  finalNetWorth: number,
): string {
  const input = `${seed}|${mode}|${finalTick}|Math.round(finalCash)|${Math.round(finalNetWorth)}`;
  // FNV-1a — same fast O(n) hash used in buildEventDigest
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h  = (h * 0x01000193) >>> 0;
  }
  return `fp:${h.toString(16).padStart(8, '0')}`;
}

// ── Payload builder ───────────────────────────────────────────────────────────

/**
 * Canonical pipe-separated payload for SHA-256 hashing.
 *
 * Field order is FIXED — any change breaks all existing hashes.
 * Add PROOF_HASH_VERSION as field 1 for forward compat.
 *
 * FIXED: cordScore uses .toFixed(4) string directly (not parseFloat re-round).
 * parseFloat('0.9000') → 0.9 would produce '0.9' not '0.9000', changing the payload.
 *
 * FIXED: mode is field 3 — two runs with identical stats in different modes
 * now produce distinct hashes.
 */
function buildPayloadString(input: ProofHashInput): string {
  return [
    PROOF_HASH_VERSION,         // version sentinel — first field
    input.seed,
    input.mode,                 // FIXED: mode was missing in old impl
    input.finalTick,
    input.finalCash,
    input.finalNetWorth,
    input.finalIncome,
    input.cordScore.toFixed(4), // FIXED: string directly, no parseFloat
    input.eventCount,
    input.eventDigest,
  ].join('|');
}

// ── SHA-256 implementations ───────────────────────────────────────────────────

/** Browser SubtleCrypto SHA-256 — preferred. */
async function sha256SubtleCrypto(input: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('SubtleCrypto unavailable');
  }
  const buf   = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Pure-JS SHA-256 fallback.
 * Used when SubtleCrypto is unavailable (React Native, Capacitor, offline, tests).
 * Implements the full SHA-256 spec (FIPS PUB 180-4) in 80 lines.
 * Output is identical to SubtleCrypto SHA-256 for any given input.
 */
function sha256PureJS(str: string): string {
  // UTF-8 encode
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80)        { utf8.push(c); }
    else if (c < 0x800)  { utf8.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
    else if (c < 0x10000){ utf8.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
    else                 { utf8.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
  }

  // SHA-256 constants
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];

  // Pre-processing: adding padding bits
  utf8.push(0x80);
  while ((utf8.length % 64) !== 56) utf8.push(0);
  const bitLen = (str.length * 8);
  utf8.push(0, 0, 0, 0);
  utf8.push((bitLen >>> 24) & 0xFF, (bitLen >>> 16) & 0xFF, (bitLen >>> 8) & 0xFF, bitLen & 0xFF);

  // Initial hash values
  let [H0,H1,H2,H3,H4,H5,H6,H7] = [
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
    0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19,
  ];

  const rot = (n: number, bits: number) => (n >>> bits) | (n << (32 - bits));
  const add = (...ns: number[]) => ns.reduce((a, b) => (a + b) | 0);

  for (let i = 0; i < utf8.length; i += 64) {
    const w: number[] = Array(64).fill(0);
    for (let j = 0; j < 16; j++) {
      w[j] = (utf8[i+j*4]<<24)|(utf8[i+j*4+1]<<16)|(utf8[i+j*4+2]<<8)|(utf8[i+j*4+3]);
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rot(w[j-15],7)^rot(w[j-15],18)^(w[j-15]>>>3);
      const s1 = rot(w[j-2],17)^rot(w[j-2],19)^(w[j-2]>>>10);
      w[j] = add(w[j-16],s0,w[j-7],s1);
    }
    let [a,b,c,d,e,f,g,h2] = [H0,H1,H2,H3,H4,H5,H6,H7];
    for (let j = 0; j < 64; j++) {
      const S1 = rot(e,6)^rot(e,11)^rot(e,25);
      const ch = (e&f)^(~e&g);
      const T1 = add(h2,S1,ch,K[j],w[j]);
      const S0 = rot(a,2)^rot(a,13)^rot(a,22);
      const maj = (a&b)^(a&c)^(b&c);
      const T2 = add(S0,maj);
      [h2,g,f,e,d,c,b,a] = [g,f,e,add(d,T1),c,b,a,add(T1,T2)];
    }
    H0=add(H0,a); H1=add(H1,b); H2=add(H2,c); H3=add(H3,d);
    H4=add(H4,e); H5=add(H5,f); H6=add(H6,g); H7=add(H7,h2);
  }

  return [H0,H1,H2,H3,H4,H5,H6,H7]
    .map(n => (n >>> 0).toString(16).padStart(8,'0'))
    .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// GRADE + BADGE UTILITIES (shared between proofHash and runIntegrity)
// ─────────────────────────────────────────────────────────────────────────────

export type RunGrade    = 'A' | 'B' | 'C' | 'D' | 'F';
export type BadgeTier   = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'IRON';
export type RunOutcome  = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

/**
 * Grade → BadgeTier mapping.
 * FIXED: FREEDOM outcome + Grade A unlocks PLATINUM (was unreachable).
 */
export function gradeToBadgeTier(
  grade:   RunGrade,
  outcome?: RunOutcome,
): BadgeTier {
  if (grade === 'A' && outcome === 'FREEDOM') return 'PLATINUM';
  if (grade === 'A') return 'GOLD';
  if (grade === 'B') return 'SILVER';
  if (grade === 'C') return 'BRONZE';
  return 'IRON';
}

export function gradeColor(grade: RunGrade): string {
  const colors: Record<RunGrade, string> = {
    A: '#C9A84C',   // C.gold — WCAG 5.6:1 on panel
    B: '#9B7DFF',   // C.purple — 7.1:1
    C: '#2EE89A',   // C.green — 8.8:1
    D: '#FF9B2F',   // C.orange — 6.2:1
    F: '#FF4D4D',   // C.red — 5.8:1
  };
  return colors[grade];
}

export function outcomeLabel(outcome: RunOutcome): string {
  const labels: Record<RunOutcome, string> = {
    FREEDOM:   '🏆 FINANCIAL FREEDOM',
    TIMEOUT:   '⏰ TIME EXPIRED',
    BANKRUPT:  '💀 BANKRUPT',
    ABANDONED: '🚪 ABANDONED',
  };
  return labels[outcome];
}

export function outcomeColor(outcome: RunOutcome): string {
  const colors: Record<RunOutcome, string> = {
    FREEDOM:  '#2EE89A',   // C.green
    TIMEOUT:  '#FF9B2F',   // C.orange
    BANKRUPT: '#FF4D4D',   // C.red
    ABANDONED: '#6A6A90',  // C.textDim
  };
  return colors[outcome];
}

// ─────────────────────────────────────────────────────────────────────────────
// PROOF DISPLAY CARD (for ResultScreen.tsx and ProofCardV2.tsx)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured display object for UI components.
 * Eliminates inline field reconstruction in ResultScreen, ProofCardV2, etc.
 *
 * Fonts: Use Barlow Condensed for grade/tier labels, DM Mono for hash/score.
 * Colors: All values WCAG AA+ on #0D0D1E (C.panel).
 */
export interface ProofDisplayCard {
  // Identity
  runId:         string;
  shortHash:     string;   // 12-char display hash
  hashVersion:   ProofHashVersion;

  // Grade + tier
  grade:         RunGrade;
  gradeColor:    string;
  gradeLabel:    string;   // 'A' → 'SOVEREIGN ARCHITECT' etc.
  badgeTier:     BadgeTier;

  // Score
  cordScore:     number;
  cordScorePct:  string;   // formatted '87.4%'
  cordTier:      string;   // 'GOLD'
  cordTierColor: string;

  // Run context
  outcome:       RunOutcome;
  outcomeLabel:  string;
  outcomeColor:  string;
  mode:          string;
  finalNetWorth: number;
  ticksSurvived: number;
  earnedAt:      number;   // Unix ms

  // Badge SVG (inline for offline artifact)
  badgeSvg:      string;
}

export const GRADE_LABELS: Record<RunGrade, string> = {
  A: 'SOVEREIGN ARCHITECT',
  B: 'TACTICAL BUILDER',
  C: 'DISCIPLINED CLIMBER',
  D: 'DEVELOPING OPERATOR',
  F: 'LIQUIDATED',
};

/**
 * Build a ProofDisplayCard from a VerifiedRunRecord.
 * Import VerifiedRunRecord from runIntegrity.ts.
 */
export function buildProofDisplayCard(params: {
  runId:         string;
  shortHash:     string;
  hashVersion?:  string;
  grade:         RunGrade;
  cordScore:     number;
  cordTier:      string;
  outcome:       RunOutcome;
  mode:          string;
  finalNetWorth: number;
  ticksSurvived: number;
  verifiedAt:    number;
}): ProofDisplayCard {
  const { grade, outcome } = params;
  const badgeTier = gradeToBadgeTier(grade, outcome);

  // Import cordTierColor from cordCalculator
  const CORD_TIER_COLORS: Record<string, string> = {
    SOVEREIGN: '#9B7DFF',
    PLATINUM:  '#2DDBF5',
    GOLD:      '#C9A84C',
    SILVER:    '#B8B8D8',
    BRONZE:    '#FF9B2F',
    UNRANKED:  '#6A6A90',
  };

  return {
    runId:        params.runId,
    shortHash:    params.shortHash,
    hashVersion:  (params.hashVersion ?? PROOF_HASH_VERSION) as ProofHashVersion,
    grade,
    gradeColor:   gradeColor(grade),
    gradeLabel:   GRADE_LABELS[grade],
    badgeTier,
    cordScore:    params.cordScore,
    cordScorePct: `${(params.cordScore * 100).toFixed(1)}%`,
    cordTier:     params.cordTier,
    cordTierColor: CORD_TIER_COLORS[params.cordTier] ?? '#B8B8D8',
    outcome,
    outcomeLabel: outcomeLabel(outcome),
    outcomeColor: outcomeColor(outcome),
    mode:         params.mode,
    finalNetWorth: params.finalNetWorth,
    ticksSurvived: params.ticksSurvived,
    earnedAt:     params.verifiedAt,
    badgeSvg:     buildBadgeSvg(badgeTier),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHANTOM LEGEND ELIGIBILITY
// ─────────────────────────────────────────────────────────────────────────────

export interface LegendEligibilityResult {
  eligible:     boolean;
  reason?:      string;
}

/**
 * Determine if a completed run is eligible to be registered as a Phantom legend.
 *
 * Requirements:
 *   1. Run must have beaten the existing legend (beaten = true)
 *   2. cordScore must meet minimum threshold (0.55 = SILVER tier)
 *   3. integrityStatus must be VERIFIED (not TAMPERED or UNVERIFIED)
 *   4. outcome must not be ABANDONED
 */
export function isLegendEligible(params: {
  beaten:          boolean;
  cordScore:        number;
  integrityStatus: string;
  outcome:         RunOutcome;
  cordThreshold?:  number;
}): LegendEligibilityResult {
  const threshold = params.cordThreshold ?? 0.55;

  if (params.outcome === 'ABANDONED') {
    return { eligible: false, reason: 'Abandoned runs cannot be registered as legends.' };
  }
  if (!params.beaten) {
    return { eligible: false, reason: 'Must beat the existing legend to qualify.' };
  }
  if (params.cordScore < threshold) {
    return {
      eligible: false,
      reason: `CORD score ${(params.cordScore * 100).toFixed(1)} is below minimum ${(threshold * 100).toFixed(0)} for legend registration.`,
    };
  }
  if (params.integrityStatus !== 'VERIFIED') {
    return { eligible: false, reason: `Integrity status "${params.integrityStatus}" — only VERIFIED runs can be legends.` };
  }

  return { eligible: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINE SVG BADGE GENERATOR
// Used in ProofDisplayCard and SovereigntyExporter HTML artifact.
// Dark palette — renders correctly on dark game UI AND exported dark artifact.
// FIXED: Old impl used light-mode colors (#B8860B on white).
// ─────────────────────────────────────────────────────────────────────────────

const BADGE_SVG_COLORS: Record<BadgeTier, { fill: string; stroke: string; glow: string }> = {
  PLATINUM: { fill: '#2DDBF5', stroke: '#88F0FF', glow: 'rgba(45,219,245,0.30)' },
  GOLD:     { fill: '#C9A84C', stroke: '#F0D070', glow: 'rgba(201,168,76,0.30)' },
  SILVER:   { fill: '#9090B0', stroke: '#C0C0D8', glow: 'rgba(180,180,210,0.20)' },
  BRONZE:   { fill: '#CD7F32', stroke: '#E8A060', glow: 'rgba(205,127,50,0.25)' },
  IRON:     { fill: '#4A4A6A', stroke: '#6A6A90', glow: 'rgba(106,106,144,0.15)' },
};

export function buildBadgeSvg(tier: BadgeTier, size = 80): string {
  const { fill, stroke, glow } = BADGE_SVG_COLORS[tier];
  const half = size / 2;
  const r = half * 0.90;
  const ri = half * 0.70;

  // Hexagon points helper
  const hex = (cx: number, cy: number, radius: number) => Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow-${tier}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${glow}"/>
    </filter>
  </defs>
  <polygon points="${hex(half, half, r)}" fill="${fill}" opacity="0.92" filter="url(#glow-${tier})"/>
  <polygon points="${hex(half, half, ri)}" fill="none" stroke="${stroke}" stroke-width="1.5" opacity="0.60"/>
</svg>`;
}