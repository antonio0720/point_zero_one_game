import type { IntegrityStatus, RunAccumulatorStats, RunOutcome, RunSignature } from './types';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — SOVEREIGNTY ENGINE — PROOF GENERATOR
 * /pzo-web/src/engines/sovereignty/ProofGenerator.ts
 *
 * Responsibilities:
 *   · canonical proof_hash generation
 *   · ordered tick_stream_checksum generation
 *   · machine-readable RunSignature construction
 *   · synchronous CRC32 fallback for tick-loop-safe hashing
 *   · isomorphic SHA-256 (browser + worker + non-Node-safe fallback)
 *
 * Import rule: may import from types.ts ONLY.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export class ProofGenerator {
  private static readonly EMPTY_STRING_SHA256 =
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  private static readonly HEX_8 = /^[a-f0-9]{8}$/;
  private static readonly HEX_64 = /^[a-f0-9]{64}$/;

  /**
   * Compute the canonical proof_hash for a completed run.
   *
   * Exact input order:
   *   seed | tick_stream_checksum | outcome | finalNetWorth.toFixed(2) | userId
   */
  public async generate(params: {
    seed: string;
    tickStreamChecksum: string;
    outcome: RunOutcome | string;
    finalNetWorth: number;
    userId: string;
  }): Promise<string> {
    const seed = this.normalizeOpaqueString(params.seed, 'seed');
    const tickStreamChecksum = this.normalizeChecksum(params.tickStreamChecksum);
    const outcome = this.normalizeOpaqueString(params.outcome, 'outcome').toUpperCase();
    const finalNetWorth = this.normalizeFiniteNumber(params.finalNetWorth, 'finalNetWorth');
    const userId = this.normalizeOpaqueString(params.userId, 'userId');

    const input = [
      seed,
      tickStreamChecksum,
      outcome,
      finalNetWorth.toFixed(2),
      userId,
    ].join('|');

    return this.sha256(input);
  }

  /**
   * Build the machine-readable run signature that is persisted to storage and
   * embedded inside proof artifacts.
   */
  public buildSignature(params: {
    proofHash: string;
    accumulator: RunAccumulatorStats;
    integrityStatus: IntegrityStatus;
    signedAt?: number;
  }): RunSignature {
    const acc = params.accumulator;
    const signedAt = params.signedAt ?? Date.now();

    return {
      proofHash: this.normalizeSha256(params.proofHash, 'proofHash'),
      runId: this.normalizeOpaqueString(acc.runId, 'runId'),
      userId: this.normalizeOpaqueString(acc.userId, 'userId'),
      clientVersion: this.normalizeOpaqueString(acc.clientVersion, 'clientVersion'),
      engineVersion: this.normalizeOpaqueString(acc.engineVersion, 'engineVersion'),
      haterSabotagesCount: this.normalizeNonNegativeInteger(
        acc.haterSabotagesCount,
        'haterSabotagesCount',
      ),
      outcome: acc.outcome,
      finalNetWorth: this.normalizeFiniteNumber(acc.finalNetWorth, 'finalNetWorth'),
      ticksSurvived: this.normalizeNonNegativeInteger(acc.ticksSurvived, 'ticksSurvived'),
      integrityStatus: params.integrityStatus,
      signedAt: this.normalizeNonNegativeInteger(signedAt, 'signedAt'),
    };
  }

  /**
   * SHA-256 of ordered, pipe-joined tick hashes.
   *
   * Empty stream is valid and deterministic: SHA-256('')
   */
  public async computeTickStreamChecksum(acc: RunAccumulatorStats): Promise<string> {
    const snapshots = [...acc.tickSnapshots].sort((a, b) => a.tickIndex - b.tickIndex);

    if (snapshots.length === 0) {
      return ProofGenerator.EMPTY_STRING_SHA256;
    }

    const input = snapshots
      .map((snapshot, index) => {
        const tickIndex = this.normalizeNonNegativeInteger(
          snapshot.tickIndex,
          `tickSnapshots[${index}].tickIndex`,
        );
        const tickHash = this.normalizeTickHash(
          snapshot.tickHash,
          `tickSnapshots[${index}].tickHash`,
        );
        void tickIndex;
        return tickHash;
      })
      .join('|');

    return this.sha256(input);
  }

  /**
   * Tick-loop-safe CRC32 helper.
   * Returns lowercase 8-char hex.
   */
  public static crc32hex(input: string): string {
    let crc = 0xffffffff;

    for (let i = 0; i < input.length; i += 1) {
      crc ^= input.charCodeAt(i);
      for (let j = 0; j < 8; j += 1) {
        crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
    }

    return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Deterministic sync helper for callers that need a canonical tick-hash input
   * string before applying crc32hex().
   */
  public static buildTickHashInput(params: {
    tickIndex: number;
    pressureScore: number;
    shieldAvgIntegrity: number;
    netWorth: number;
    haterHeat: number;
  }): string {
    return [
      Math.trunc(params.tickIndex),
      params.pressureScore.toFixed(4),
      params.shieldAvgIntegrity.toFixed(2),
      params.netWorth.toFixed(2),
      Math.trunc(params.haterHeat),
    ].join('|');
  }

  private normalizeOpaqueString(value: string, field: string): string {
    if (typeof value !== 'string') {
      throw new Error(`[ProofGenerator] ${field} must be a string`);
    }

    if (value.length === 0) {
      throw new Error(`[ProofGenerator] ${field} must not be empty`);
    }

    return value;
  }

  private normalizeFiniteNumber(value: number, field: string): number {
    if (!Number.isFinite(value)) {
      throw new Error(`[ProofGenerator] ${field} must be a finite number`);
    }
    return value;
  }

  private normalizeNonNegativeInteger(value: number, field: string): number {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`[ProofGenerator] ${field} must be a non-negative integer`);
    }
    return value;
  }

  private normalizeChecksum(value: string): string {
    const normalized = this.normalizeOpaqueString(value, 'tickStreamChecksum')
      .trim()
      .toLowerCase();

    if (!ProofGenerator.HEX_64.test(normalized)) {
      throw new Error(
        '[ProofGenerator] tickStreamChecksum must be a 64-char lowercase hex SHA-256 string',
      );
    }

    return normalized;
  }

  private normalizeSha256(value: string, field: string): string {
    const normalized = this.normalizeOpaqueString(value, field).trim().toLowerCase();

    if (!ProofGenerator.HEX_64.test(normalized)) {
      throw new Error(
        `[ProofGenerator] ${field} must be a 64-char lowercase hex SHA-256 string`,
      );
    }

    return normalized;
  }

  private normalizeTickHash(value: string, field: string): string {
    const normalized = this.normalizeOpaqueString(value, field).trim().toLowerCase();

    if (!ProofGenerator.HEX_8.test(normalized) && !ProofGenerator.HEX_64.test(normalized)) {
      throw new Error(
        `[ProofGenerator] ${field} must be 8-char CRC32 hex or 64-char SHA-256 hex`,
      );
    }

    return normalized;
  }

  /**
   * Browser/worker-first SHA-256.
   * Falls back to a pure TypeScript implementation when Web Crypto is unavailable.
   * No Node imports. No Node typings required.
   */
  private async sha256(input: string): Promise<string> {
    const subtle = this.resolveSubtleCrypto();
    const bytes = this.encodeUtf8(input);

    if (subtle) {
      const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource);
      return this.bytesToHex(new Uint8Array(digest));
    }

    return this.sha256PureTs(bytes);
  }

  private resolveSubtleCrypto():
    | { digest(algorithm: 'SHA-256', data: BufferSource): Promise<ArrayBuffer> }
    | null {
    const maybeCrypto = (globalThis as typeof globalThis & {
      crypto?: {
        subtle?: { digest(algorithm: 'SHA-256', data: BufferSource): Promise<ArrayBuffer> };
      };
    }).crypto;

    return maybeCrypto?.subtle ?? null;
  }

  private encodeUtf8(input: string): Uint8Array {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(input);
    }

    const out: number[] = [];
    for (let i = 0; i < input.length; i += 1) {
      let codePoint = input.charCodeAt(i);

      if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < input.length) {
        const next = input.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          codePoint = ((codePoint - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
          i += 1;
        }
      }

      if (codePoint <= 0x7f) {
        out.push(codePoint);
      } else if (codePoint <= 0x7ff) {
        out.push(0xc0 | (codePoint >> 6));
        out.push(0x80 | (codePoint & 0x3f));
      } else if (codePoint <= 0xffff) {
        out.push(0xe0 | (codePoint >> 12));
        out.push(0x80 | ((codePoint >> 6) & 0x3f));
        out.push(0x80 | (codePoint & 0x3f));
      } else {
        out.push(0xf0 | (codePoint >> 18));
        out.push(0x80 | ((codePoint >> 12) & 0x3f));
        out.push(0x80 | ((codePoint >> 6) & 0x3f));
        out.push(0x80 | (codePoint & 0x3f));
      }
    }

    return new Uint8Array(out);
  }

  private bytesToHex(bytes: Uint8Array): string {
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) {
      out += bytes[i].toString(16).padStart(2, '0');
    }
    return out;
  }

  /** Pure TypeScript SHA-256 fallback. */
  private sha256PureTs(bytes: Uint8Array): string {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
      0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
      0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
      0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
      0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
      0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    const H = [
      0x6a09e667,
      0xbb67ae85,
      0x3c6ef372,
      0xa54ff53a,
      0x510e527f,
      0x9b05688c,
      0x1f83d9ab,
      0x5be0cd19,
    ];

    const padded = this.sha256Pad(bytes);
    const w = new Uint32Array(64);

    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let i = 0; i < 16; i += 1) {
        const j = offset + i * 4;
        w[i] =
          ((padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3]) >>> 0;
      }

      for (let i = 16; i < 64; i += 1) {
        const s0 = this.rotr(w[i - 15], 7) ^ this.rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = this.rotr(w[i - 2], 17) ^ this.rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (((w[i - 16] + s0) >>> 0) + ((w[i - 7] + s1) >>> 0)) >>> 0;
      }

      let a = H[0];
      let b = H[1];
      let c = H[2];
      let d = H[3];
      let e = H[4];
      let f = H[5];
      let g = H[6];
      let h = H[7];

      for (let i = 0; i < 64; i += 1) {
        const S1 = this.rotr(e, 6) ^ this.rotr(e, 11) ^ this.rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (((((h + S1) >>> 0) + ch) >>> 0) + ((K[i] + w[i]) >>> 0)) >>> 0;
        const S0 = this.rotr(a, 2) ^ this.rotr(a, 13) ^ this.rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      H[0] = (H[0] + a) >>> 0;
      H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0;
      H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0;
      H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0;
      H[7] = (H[7] + h) >>> 0;
    }

    return H.map((value) => value.toString(16).padStart(8, '0')).join('');
  }

  private sha256Pad(bytes: Uint8Array): Uint8Array {
    const bitLength = bytes.length * 8;
    const withOne = bytes.length + 1;
    const remainder = withOne % 64;
    const zeroPadBytes = remainder <= 56 ? 56 - remainder : 56 + (64 - remainder);
    const totalLength = withOne + zeroPadBytes + 8;
    const out = new Uint8Array(totalLength);

    out.set(bytes, 0);
    out[bytes.length] = 0x80;

    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;

    out[totalLength - 8] = (high >>> 24) & 0xff;
    out[totalLength - 7] = (high >>> 16) & 0xff;
    out[totalLength - 6] = (high >>> 8) & 0xff;
    out[totalLength - 5] = high & 0xff;
    out[totalLength - 4] = (low >>> 24) & 0xff;
    out[totalLength - 3] = (low >>> 16) & 0xff;
    out[totalLength - 2] = (low >>> 8) & 0xff;
    out[totalLength - 1] = low & 0xff;

    return out;
  }

  private rotr(value: number, bits: number): number {
    return ((value >>> bits) | (value << (32 - bits))) >>> 0;
  }
}