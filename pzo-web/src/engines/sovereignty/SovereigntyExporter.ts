//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/sovereignty/SovereigntyExporter.ts

// ═══════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SOVEREIGNTY ENGINE — SOVEREIGNTY EXPORTER
// Density6 LLC · Confidential · Do not distribute
//
// Responsibilities:
//   · Generate the proof artifact (PDF or PNG) on explicit player purchase
//   · Render a fully self-contained HTML template (inline CSS, no external deps)
//   · Stub htmlToPDF and htmlToPNG — inject via environment adapter
//   · Upload rendered blob to CDN — stub: inject CDN client
//   · Emit PROOF_ARTIFACT_READY with download URL on success
//
// CRITICAL: This class is NOT called automatically on run completion.
//           It is called only when the player explicitly requests export
//           through the purchase flow. Automatic generation for all runs
//           would be a performance violation and a product mistake.
//
// Import rules: may import from types.ts and EventBus ONLY.
// ═══════════════════════════════════════════════════════════════════

import type { EventBus } from '../core/EventBus';
import type {
  ProofArtifact,
  RunIdentity,
  ArtifactFormat,
  BadgeTier,
  RunGrade,
  RunOutcome,
  SovereigntyScoreComponents,
  ProofArtifactReadyPayload,
} from './types';

export class SovereigntyExporter {
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ── PUBLIC: EXPORT ────────────────────────────────────────────────
  /**
   * Generate and upload the proof artifact for a completed run.
   *
   * Flow:
   *   1. Build ProofArtifact metadata object
   *   2. Render self-contained HTML template
   *   3. Convert HTML → PDF or PNG (environment-injected impl)
   *   4. Upload blob to CDN — returns public URL
   *   5. Emit PROOF_ARTIFACT_READY
   *   6. Return ProofArtifact with exportUrl populated
   *
   * @param params.identity     — RunIdentity from the completed sovereignty pipeline
   * @param params.playerHandle — Display name or user ID for artifact footer
   * @param params.format       — 'PDF' or 'PNG'
   */
  public async export(params: {
    identity:     RunIdentity;
    playerHandle: string;
    format:       ArtifactFormat;
  }): Promise<ProofArtifact> {
    const { identity, playerHandle, format } = params;
    const sig   = identity.signature;
    const score = identity.score;

    const artifact: ProofArtifact = {
      runId:            sig.runId,
      proofHash:        sig.proofHash,
      grade:            score.grade,
      sovereigntyScore: score.finalScore,
      badgeTier:        this.gradeToBadgeTier(score.grade),
      playerHandle,
      outcome:          sig.outcome,
      ticksSurvived:    sig.ticksSurvived,
      finalNetWorth:    sig.finalNetWorth,
      generatedAt:      Date.now(),
      format,
    };

    const html      = this.renderArtifactHTML(artifact, score.components);
    const blob      = format === 'PDF'
      ? await this.htmlToPDF(html)
      : await this.htmlToPNG(html);

    const exportUrl = await this.uploadToCDN(blob, artifact.runId, format);
    artifact.exportUrl = exportUrl;

    const payload: ProofArtifactReadyPayload = {
      runId: sig.runId,
      exportUrl,
      format,
    };
    this.eventBus.emit('PROOF_ARTIFACT_READY', payload);

    return artifact;
  }

  // ── PRIVATE: HTML TEMPLATE RENDERER ──────────────────────────────
  /**
   * Render the full HTML proof artifact template.
   * All CSS is inline — no external stylesheets, fonts, or images.
   * Badge is an inline SVG — no external asset requests.
   * This HTML is passed directly to htmlToPDF() or htmlToPNG().
   *
   * Layout (top to bottom):
   *   ① Title bar: "POINT ZERO ONE — SOVEREIGNTY PROOF"
   *   ② Header: badge SVG | grade letter | sovereignty score | player handle
   *   ③ Run Identity: outcome, ticks survived, final net worth, run date
   *   ④ Sovereignty Breakdown: five component bars
   *   ⑤ Proof Hash: full 64-char SHA-256 in monospace
   *   ⑥ Footer: Density6 LLC watermark | engine verification mark
   */
  private renderArtifactHTML(
    artifact: ProofArtifact,
    components: SovereigntyScoreComponents,
  ): string {
    const gradeColor    = this.gradeColor(artifact.grade);
    const badgeSVG      = this.badgeSVG(artifact.badgeTier);
    const outcomeLabel  = this.outcomeLabel(artifact.outcome);
    const outcomeClr    = this.outcomeColor(artifact.outcome);
    const netWorthStr   = '$' + artifact.finalNetWorth.toLocaleString('en-US', { maximumFractionDigits: 0 });
    const dateStr       = new Date(artifact.generatedAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    background: #1A1A2E;
    color: #F4F6F8;
    width: 600px;
    height: 900px;
    padding: 40px;
    position: relative;
  }
  .title {
    font-size: 14px;
    color: #888;
    letter-spacing: 3px;
    text-transform: uppercase;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-top: 16px;
    margin-bottom: 32px;
  }
  .grade {
    font-size: 96px;
    font-weight: 900;
    color: ${gradeColor};
    line-height: 1;
  }
  .score {
    font-size: 24px;
    color: #B8860B;
    font-weight: bold;
  }
  .player-handle {
    font-size: 13px;
    color: #888;
    margin-top: 4px;
  }
  .section-title {
    font-size: 11px;
    color: #B8860B;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 20px 0 10px;
  }
  .data-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #2A2F3B;
  }
  .data-label { color: #888; font-size: 13px; }
  .data-value { color: #F4F6F8; font-size: 13px; font-weight: bold; }
  .outcome-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: bold;
    background: ${outcomeClr}22;
    color: ${outcomeClr};
  }
  .bar-row { margin: 6px 0; }
  .bar-label {
    font-size: 12px;
    color: #888;
    display: flex;
    justify-content: space-between;
    margin-bottom: 3px;
  }
  .bar-track {
    background: #2A2F3B;
    height: 6px;
    border-radius: 3px;
  }
  .bar-fill {
    height: 100%;
    border-radius: 3px;
    background: #4A90D9;
  }
  .hash {
    font-family: monospace;
    font-size: 11px;
    color: #4A90D9;
    background: #0F0F1A;
    padding: 8px 12px;
    border-radius: 4px;
    word-break: break-all;
    line-height: 1.6;
  }
  .footer {
    position: absolute;
    bottom: 32px;
    left: 40px;
    right: 40px;
    font-size: 10px;
    color: #555;
    display: flex;
    justify-content: space-between;
  }
</style>
</head>
<body>
  <div class="title">POINT ZERO ONE — SOVEREIGNTY PROOF</div>

  <div class="header">
    ${badgeSVG}
    <div>
      <div class="grade">${artifact.grade}</div>
      <div class="score">${artifact.sovereigntyScore.toFixed(3)}</div>
      <div class="player-handle">${artifact.playerHandle}</div>
    </div>
  </div>

  <div class="section-title">Run Identity</div>
  <div class="data-row">
    <span class="data-label">Outcome</span>
    <span class="outcome-badge">${outcomeLabel}</span>
  </div>
  <div class="data-row">
    <span class="data-label">Ticks Survived</span>
    <span class="data-value">${artifact.ticksSurvived}</span>
  </div>
  <div class="data-row">
    <span class="data-label">Final Net Worth</span>
    <span class="data-value">${netWorthStr}</span>
  </div>
  <div class="data-row">
    <span class="data-label">Run Date</span>
    <span class="data-value">${dateStr}</span>
  </div>

  <div class="section-title">Sovereignty Breakdown</div>
  ${this.renderComponentBars(components)}

  <div class="section-title">Proof Hash</div>
  <div class="hash">${artifact.proofHash}</div>

  <div class="footer">
    <div>DENSITY6 LLC · POINT ZERO ONE</div>
    <div>VERIFIED BY SOVEREIGNTY ENGINE</div>
  </div>
</body>
</html>`;
  }

  // ── PRIVATE: COMPONENT BARS ───────────────────────────────────────
  /**
   * Render five horizontal progress bars representing each score component.
   * Values are multiplied by 100 for percentage display.
   */
  private renderComponentBars(components: SovereigntyScoreComponents): string {
    const items: Array<{ label: string; value: number }> = [
      { label: 'Ticks Survived',     value: components.ticksSurvivedPct },
      { label: 'Shields Maintained', value: components.shieldsMaintainedPct },
      { label: 'Hater Resistance',   value: components.haterBlockRate },
      { label: 'Decision Speed',     value: components.decisionSpeedScore },
      { label: 'Cascade Control',    value: components.cascadeBreakRate },
    ];

    return items.map(item => {
      const pct = (item.value * 100).toFixed(1);
      return `
      <div class="bar-row">
        <div class="bar-label">
          <span>${item.label}</span>
          <span>${pct}%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
    }).join('');
  }

  // ── PRIVATE: CONVERSION STUBS ─────────────────────────────────────
  /**
   * Convert HTML string → PDF Blob.
   *
   * Injection required — environment determines implementation:
   *   · Server-side:  puppeteer (headless Chromium)
   *   · Client-side:  html2canvas + jsPDF
   *
   * To inject: extend SovereigntyExporter and override this method,
   * or pass an htmlConverter adapter via constructor option.
   */
  private async htmlToPDF(_html: string): Promise<Blob> {
    throw new Error(
      '[SovereigntyExporter] htmlToPDF not implemented. ' +
      'Inject via puppeteer (server) or jsPDF (client).',
    );
  }

  /**
   * Convert HTML string → PNG Blob.
   *
   * Injection required:
   *   · Server-side:  puppeteer screenshot
   *   · Client-side:  html2canvas
   */
  private async htmlToPNG(_html: string): Promise<Blob> {
    throw new Error(
      '[SovereigntyExporter] htmlToPNG not implemented. ' +
      'Inject via html2canvas or puppeteer screenshot.',
    );
  }

  /**
   * Upload rendered blob to CDN and return the public download URL.
   *
   * Key format: proof-artifacts/{runId}.{format.toLowerCase()}
   * Target CDN: S3 or Cloudflare R2 — inject your CDN client.
   */
  private async uploadToCDN(
    _blob: Blob,
    _runId: string,
    _format: ArtifactFormat,
  ): Promise<string> {
    throw new Error(
      '[SovereigntyExporter] uploadToCDN not implemented. ' +
      'Inject your S3 or Cloudflare R2 client.',
    );
  }

  // ── PRIVATE: VISUAL HELPERS ───────────────────────────────────────

  private gradeColor(grade: RunGrade): string {
    const colors: Record<RunGrade, string> = {
      A: '#B8860B',  // dark gold
      B: '#C0C0C0',  // silver
      C: '#CD7F32',  // bronze
      D: '#888888',  // gray
      F: '#555555',  // charcoal
    };
    return colors[grade];
  }

  private gradeToBadgeTier(grade: RunGrade): BadgeTier {
    if (grade === 'A') return 'GOLD';
    if (grade === 'B') return 'SILVER';
    if (grade === 'C') return 'BRONZE';
    return 'IRON';
  }

  private outcomeColor(outcome: RunOutcome): string {
    const colors: Record<RunOutcome, string> = {
      FREEDOM:   '#4CAF50',
      TIMEOUT:   '#FF9800',
      BANKRUPT:  '#F44336',
      ABANDONED: '#666666',
    };
    return colors[outcome];
  }

  private outcomeLabel(outcome: RunOutcome): string {
    const labels: Record<RunOutcome, string> = {
      FREEDOM:   '🏆 FINANCIAL FREEDOM',
      TIMEOUT:   '⏰ TIME EXPIRED',
      BANKRUPT:  '💀 BANKRUPT',
      ABANDONED: '🚪 ABANDONED',
    };
    return labels[outcome];
  }

  /**
   * Generate an inline SVG hexagon badge.
   * Grade A → GOLD. B → SILVER. C → BRONZE. D/F → IRON. (PLATINUM reserved)
   * Two nested hexagons: outer filled, inner outlined at 50% opacity.
   */
  private badgeSVG(tier: BadgeTier): string {
    const colors: Record<BadgeTier, string> = {
      PLATINUM: '#E5E4E2',
      GOLD:     '#B8860B',
      SILVER:   '#C0C0C0',
      BRONZE:   '#CD7F32',
      IRON:     '#555555',
    };
    const color = colors[tier];
    return `<svg width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <polygon
    points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5"
    fill="${color}" opacity="0.9"/>
  <polygon
    points="50,15 80,31 80,68 50,85 20,68 20,31"
    fill="none" stroke="${color}" stroke-width="2" opacity="0.5"/>
</svg>`;
  }
}