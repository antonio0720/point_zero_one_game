// ═══════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SOVEREIGNTY ENGINE — SOVEREIGNTY EXPORTER
// Density6 LLC · Confidential · Do not distribute
// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/sovereignty/SovereigntyExporter.ts
// ═══════════════════════════════════════════════════════════════════

import type { EventBus } from '../core/EventBus';
import type {
  ArtifactFormat,
  BadgeTier,
  ProofArtifact,
  ProofArtifactReadyPayload,
  RunGrade,
  RunIdentity,
  RunOutcome,
  SovereigntyScoreComponents,
} from './types';

interface SovereigntyExportStorageAdapter {
  upload(params: {
    key: string;
    blob: Blob;
    format: ArtifactFormat;
    metadata: Record<string, string>;
  }): Promise<string>;
}

interface SovereigntyExporterOptions {
  storageAdapter?: SovereigntyExportStorageAdapter;
  renderScale?: number;
  objectUrlFallback?: boolean;
}

export class SovereigntyExporter {
  private static readonly ARTIFACT_WIDTH = 600;
  private static readonly ARTIFACT_HEIGHT = 900;

  private readonly eventBus: EventBus;
  private readonly storageAdapter?: SovereigntyExportStorageAdapter;
  private readonly renderScale: number;
  private readonly objectUrlFallback: boolean;

  constructor(eventBus: EventBus, options: SovereigntyExporterOptions = {}) {
    this.eventBus = eventBus;
    this.storageAdapter = options.storageAdapter;
    this.renderScale =
      Number.isFinite(options.renderScale) && (options.renderScale ?? 0) > 0
        ? Number(options.renderScale)
        : 2;
    this.objectUrlFallback = options.objectUrlFallback ?? true;
  }

  public async export(params: {
    identity: RunIdentity;
    playerHandle: string;
    format: ArtifactFormat;
  }): Promise<ProofArtifact> {
    const { identity, format } = params;
    const playerHandle = this.normalizePlayerHandle(
      params.playerHandle,
      identity.signature.userId,
    );
    const sig = identity.signature;
    const score = identity.score;

    const artifact: ProofArtifact = {
      runId: sig.runId,
      proofHash: sig.proofHash,
      grade: score.grade,
      sovereigntyScore: score.finalScore,
      badgeTier: this.gradeToBadgeTier(score.grade),
      playerHandle,
      outcome: sig.outcome,
      ticksSurvived: sig.ticksSurvived,
      finalNetWorth: sig.finalNetWorth,
      generatedAt: Date.now(),
      format,
    };

    const html = this.renderArtifactHTML({
      artifact,
      identity,
      playerHandle,
    });

    const blob = format === 'PDF'
      ? await this.htmlToPDF(html)
      : await this.htmlToPNG(html);

    const exportUrl = await this.uploadToCDN(blob, artifact.runId, format, {
      proofHash: artifact.proofHash,
      grade: artifact.grade,
      outcome: artifact.outcome,
      integrityStatus: identity.integrityStatus,
      engineVersion: identity.signature.engineVersion,
    });

    artifact.exportUrl = exportUrl;

    const payload: ProofArtifactReadyPayload = {
      runId: artifact.runId,
      exportUrl,
      format,
    };

    this.emitProofArtifactReady(payload);

    return artifact;
  }

  // ── HTML TEMPLATE ──────────────────────────────────────────────

  private renderArtifactHTML(params: {
    artifact: ProofArtifact;
    identity: RunIdentity;
    playerHandle: string;
  }): string {
    const { artifact, identity, playerHandle } = params;
    const gradeColor = this.gradeColor(artifact.grade);
    const badgeSVG = this.badgeSVG(artifact.badgeTier);
    const outcomeColor = this.outcomeColor(artifact.outcome);
    const outcomeLabel = this.outcomeLabel(artifact.outcome);
    const netWorthStr = this.formatCurrency(artifact.finalNetWorth);
    const dateStr = new Date(artifact.generatedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const proofHashVisible =
      `${artifact.proofHash.slice(0, 16)}...${artifact.proofHash.slice(-8)}`;
    const fullHashEscaped = this.escapeHtml(artifact.proofHash);
    const integrityBanner = this.renderIntegrityBanner(identity.integrityStatus);
    const componentBars = this.renderComponentBars(identity.score.components);
    const escapedHandle = this.escapeHtml(playerHandle);
    const escapedEngineVersion = this.escapeHtml(identity.signature.engineVersion);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="proof-hash" content="${fullHashEscaped}" />
<meta name="engine-version" content="${escapedEngineVersion}" />
<title>Point Zero One — Sovereignty Proof</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${SovereigntyExporter.ARTIFACT_WIDTH}px;
    height: ${SovereigntyExporter.ARTIFACT_HEIGHT}px;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    background:
      radial-gradient(circle at top left, rgba(74, 144, 217, 0.16), transparent 32%),
      linear-gradient(180deg, #15172B 0%, #111322 100%);
    color: #F4F6F8;
    position: relative;
    overflow: hidden;
  }
  .frame {
    position: absolute;
    inset: 0;
    padding: 34px 34px 28px 34px;
    border: 1px solid rgba(255,255,255,0.08);
    background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
  }
  .topline {
    font-size: 12px;
    color: #9AA3B2;
    letter-spacing: 2.8px;
    text-transform: uppercase;
    margin-bottom: 14px;
  }
  .headline {
    display: grid;
    grid-template-columns: 94px 1fr;
    gap: 18px;
    align-items: center;
    margin-bottom: 22px;
  }
  .grade-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .grade {
    font-size: 104px;
    line-height: 0.92;
    font-weight: 900;
    color: ${gradeColor};
  }
  .score {
    font-size: 24px;
    line-height: 1;
    font-weight: 700;
    color: #F8D477;
  }
  .handle {
    margin-top: 8px;
    font-size: 14px;
    color: #B7C0CE;
    font-weight: 600;
  }
  .subgrid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .card {
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(8, 10, 20, 0.54);
    border-radius: 14px;
    padding: 14px 16px;
    backdrop-filter: blur(6px);
  }
  .section-title {
    color: #D7B967;
    text-transform: uppercase;
    letter-spacing: 2px;
    font-size: 11px;
    margin-bottom: 10px;
    font-weight: 700;
  }
  .identity-grid {
    display: grid;
    gap: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    padding-bottom: 8px;
  }
  .row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .label {
    color: #97A0AF;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .value {
    color: #F4F6F8;
    font-size: 13px;
    font-weight: 700;
    text-align: right;
  }
  .outcome-badge {
    display: inline-block;
    border-radius: 999px;
    padding: 4px 10px;
    color: ${outcomeColor};
    background: ${outcomeColor}22;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.4px;
  }
  .bars {
    display: grid;
    gap: 10px;
  }
  .bar-row {
    display: grid;
    gap: 4px;
  }
  .bar-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #A7B0BE;
    font-size: 12px;
  }
  .bar-track {
    width: 100%;
    height: 8px;
    border-radius: 999px;
    background: rgba(255,255,255,0.08);
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #4A90D9, #79D1F4);
  }
  .hashbox {
    border-radius: 12px;
    background: #0C1020;
    border: 1px solid rgba(74, 144, 217, 0.24);
    padding: 12px;
    font-family: "Courier New", Courier, monospace;
    color: #6BB8FF;
  }
  .hash-label {
    color: #8E99AA;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 6px;
  }
  .hash-visible {
    font-size: 12px;
    line-height: 1.5;
    word-break: break-all;
  }
  .hash-full {
    font-size: 1px;
    color: transparent;
    line-height: 1;
    user-select: none;
  }
  .footer {
    position: absolute;
    left: 34px;
    right: 34px;
    bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #667185;
    font-size: 10px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }
  .watermark {
    font-weight: 700;
  }
  .verify {
    text-align: right;
  }
  .integrity-banner {
    margin-bottom: 14px;
    padding: 10px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.3px;
  }
  .integrity-banner.tampered {
    color: #FFD0D0;
    background: rgba(244, 67, 54, 0.16);
    border: 1px solid rgba(244, 67, 54, 0.34);
  }
  .integrity-banner.unverified {
    color: #FFE5B8;
    background: rgba(255, 152, 0, 0.16);
    border: 1px solid rgba(255, 152, 0, 0.34);
  }
</style>
</head>
<body>
  <div class="frame">
    <div class="topline">Point Zero One — Sovereignty Proof</div>
    ${integrityBanner}
    <div class="headline">
      <div>${badgeSVG}</div>
      <div class="grade-wrap">
        <div class="grade">${artifact.grade}</div>
        <div class="score">${artifact.sovereigntyScore.toFixed(3)}</div>
        <div class="handle">${escapedHandle}</div>
      </div>
    </div>

    <div class="subgrid">
      <div class="card">
        <div class="section-title">Run Identity</div>
        <div class="identity-grid">
          <div class="row">
            <div class="label">Outcome</div>
            <div class="value"><span class="outcome-badge">${outcomeLabel}</span></div>
          </div>
          <div class="row">
            <div class="label">Ticks Survived</div>
            <div class="value">${artifact.ticksSurvived}</div>
          </div>
          <div class="row">
            <div class="label">Final Net Worth</div>
            <div class="value">${netWorthStr}</div>
          </div>
          <div class="row">
            <div class="label">Run Date</div>
            <div class="value">${dateStr}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">Sovereignty Breakdown</div>
        <div class="bars">${componentBars}</div>
      </div>

      <div class="card">
        <div class="section-title">Proof Hash</div>
        <div class="hashbox" data-full-hash="${fullHashEscaped}">
          <div class="hash-label">Visible</div>
          <div class="hash-visible">${this.escapeHtml(proofHashVisible)}</div>
          <div class="hash-full">${fullHashEscaped}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="watermark">Density6 LLC · Point Zero One</div>
    <div class="verify">Verified by Sovereignty Engine · ${escapedEngineVersion}</div>
  </div>
</body>
</html>`;
  }

  private renderIntegrityBanner(integrityStatus: RunIdentity['integrityStatus']): string {
    if (integrityStatus === 'TAMPERED') {
      return `<div class="integrity-banner tampered">⚠ TAMPERED RUN — proof retained, integrity flagged</div>`;
    }

    if (integrityStatus === 'UNVERIFIED') {
      return `<div class="integrity-banner unverified">⚠ UNVERIFIED RUN — proof retained, integrity incomplete</div>`;
    }

    return '';
  }

  private renderComponentBars(components: SovereigntyScoreComponents): string {
    const items: Array<{ label: string; value: number }> = [
      { label: 'Ticks Survived', value: components.ticksSurvivedPct },
      { label: 'Shields Maintained', value: components.shieldsMaintainedPct },
      { label: 'Hater Resistance', value: components.haterBlockRate },
      { label: 'Decision Speed', value: components.decisionSpeedScore },
      { label: 'Cascade Control', value: components.cascadeBreakRate },
    ];

    return items.map((item) => {
      const pct = this.clamp(item.value, 0, 1) * 100;
      const pctText = pct.toFixed(1);

      return `
<div class="bar-row">
  <div class="bar-label">
    <span>${this.escapeHtml(item.label)}</span>
    <span>${pctText}%</span>
  </div>
  <div class="bar-track">
    <div class="bar-fill" style="width:${pctText}%"></div>
  </div>
</div>`;
    }).join('');
  }

  // ── RENDERING ──────────────────────────────────────────────────

  private async htmlToPNG(html: string): Promise<Blob> {
    const canvas = await this.renderHtmlToCanvas(html);
    return this.canvasToBlob(canvas, 'image/png');
  }

  private async htmlToPDF(html: string): Promise<Blob> {
    const canvas = await this.renderHtmlToCanvas(html);
    const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);

    if (!imageData) {
      throw new Error('[SovereigntyExporter] Unable to read canvas image data for PDF export');
    }

    const pdfBytes = this.buildPdfFromImageData(imageData, canvas.width, canvas.height);
    return new Blob([this.uint8ArrayToArrayBuffer(pdfBytes)], { type: 'application/pdf' });
  }

  private async renderHtmlToCanvas(html: string): Promise<HTMLCanvasElement> {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      throw new Error(
        '[SovereigntyExporter] Browser DOM unavailable. ' +
        'Use a storage/render adapter in non-browser environments.',
      );
    }

    const width = SovereigntyExporter.ARTIFACT_WIDTH;
    const height = SovereigntyExporter.ARTIFACT_HEIGHT;
    const scale = this.renderScale;

    const styleContent = this.extractTagContent(html, 'style');
    const bodyContent = this.extractTagContent(html, 'body');

    const svgMarkup = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;">
      <style>${styleContent}</style>
      ${bodyContent}
    </div>
  </foreignObject>
</svg>`.trim();

    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(svgBlob);

    try {
      const image = await this.loadImage(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('[SovereigntyExporter] Unable to acquire 2D canvas context');
      }

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error('[SovereigntyExporter] Failed to load SVG render image'));
      image.src = src;
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error(`[SovereigntyExporter] Canvas toBlob failed for ${mimeType}`));
          return;
        }
        resolve(blob);
      }, mimeType);
    });
  }

  /**
   * Minimal single-page PDF generator using an ASCIIHex-encoded RGB image stream.
   * This keeps the exporter dependency-free while still producing a real PDF blob.
   */
  private buildPdfFromImageData(
    imageData: ImageData,
    width: number,
    height: number,
  ): Uint8Array {
    const rgbHex = this.imageDataToAsciiHexRgb(imageData.data);

    const objects: string[] = [];

    objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    objects.push(
      `3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 ${width} ${height}]
/Resources << /XObject << /Im0 4 0 R >> >>
/Contents 5 0 R
>>
endobj
`,
    );
    objects.push(
      `4 0 obj
<<
/Type /XObject
/Subtype /Image
/Width ${width}
/Height ${height}
/ColorSpace /DeviceRGB
/BitsPerComponent 8
/Filter /ASCIIHexDecode
/Length ${rgbHex.length + 1}
>>
stream
${rgbHex}>
endstream
endobj
`,
    );

    const contentStream = `q\n${width} 0 0 -${height} 0 ${height} cm\n/Im0 Do\nQ\n`;
    objects.push(
      `5 0 obj
<< /Length ${contentStream.length} >>
stream
${contentStream}endstream
endobj
`,
    );

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];

    for (const object of objects) {
      offsets.push(pdf.length);
      pdf += object;
    }

    const xrefOffset = pdf.length;
    pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f
`;

    for (let i = 1; i < offsets.length; i += 1) {
      pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF`;

    return new TextEncoder().encode(pdf);
  }

  private imageDataToAsciiHexRgb(rgba: Uint8ClampedArray): string {
    let hex = '';

    for (let i = 0; i < rgba.length; i += 4) {
      const alpha = rgba[i + 3] / 255;
      const r = this.compositeChannel(rgba[i], alpha, 255);
      const g = this.compositeChannel(rgba[i + 1], alpha, 255);
      const b = this.compositeChannel(rgba[i + 2], alpha, 255);

      hex += r.toString(16).padStart(2, '0');
      hex += g.toString(16).padStart(2, '0');
      hex += b.toString(16).padStart(2, '0');
    }

    return hex.toUpperCase();
  }

  private compositeChannel(channel: number, alpha: number, background: number): number {
    return Math.max(
      0,
      Math.min(255, Math.round(channel * alpha + background * (1 - alpha))),
    );
  }

  private uint8ArrayToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
  }

  // ── STORAGE ────────────────────────────────────────────────────

  private async uploadToCDN(
    blob: Blob,
    runId: string,
    format: ArtifactFormat,
    metadata: Record<string, string>,
  ): Promise<string> {
    const key = `proof-artifacts/${runId}.${format.toLowerCase()}`;

    if (this.storageAdapter) {
      return this.storageAdapter.upload({
        key,
        blob,
        format,
        metadata,
      });
    }

    if (
      this.objectUrlFallback &&
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL === 'function'
    ) {
      return URL.createObjectURL(blob);
    }

    throw new Error(
      '[SovereigntyExporter] No storage adapter configured and object URL fallback unavailable',
    );
  }

  // ── VISUAL HELPERS ─────────────────────────────────────────────

  private gradeColor(grade: RunGrade): string {
    const colors: Record<RunGrade, string> = {
      A: '#D4AF37',
      B: '#C0C0C0',
      C: '#CD7F32',
      D: '#888888',
      F: '#555555',
    };

    return colors[grade];
  }

  private gradeToBadgeTier(grade: RunGrade): BadgeTier {
    if (grade === 'A') return 'GOLD';
    if (grade === 'B') return 'SILVER';
    if (grade === 'C') return 'BRONZE';
    if (grade === 'D') return 'IRON';
    return 'IRON';
  }

  private outcomeColor(outcome: RunOutcome): string {
    const colors: Record<RunOutcome, string> = {
      FREEDOM: '#4CAF50',
      TIMEOUT: '#FF9800',
      BANKRUPT: '#F44336',
      ABANDONED: '#666666',
    };

    return colors[outcome];
  }

  private outcomeLabel(outcome: RunOutcome): string {
    const labels: Record<RunOutcome, string> = {
      FREEDOM: 'FINANCIAL FREEDOM',
      TIMEOUT: 'TIME EXPIRED',
      BANKRUPT: 'BANKRUPT',
      ABANDONED: 'ABANDONED',
    };

    return labels[outcome];
  }

  private badgeSVG(tier: BadgeTier): string {
    const colors: Record<BadgeTier, string> = {
      PLATINUM: '#E5E4E2',
      GOLD: '#D4AF37',
      SILVER: '#C0C0C0',
      BRONZE: '#CD7F32',
      IRON: '#555555',
    };

    const color = colors[tier];

    return `<svg width="92" height="92" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${tier} sovereignty badge">
  <defs>
    <linearGradient id="badge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color}" stop-opacity="1" />
      <stop offset="100%" stop-color="${color}" stop-opacity="0.65" />
    </linearGradient>
  </defs>
  <polygon
    points="50,4 88,26 88,74 50,96 12,74 12,26"
    fill="url(#badge-grad)"
    stroke="${color}"
    stroke-width="2"
    opacity="0.96"
  />
  <polygon
    points="50,15 78,31 78,69 50,85 22,69 22,31"
    fill="none"
    stroke="rgba(255,255,255,0.45)"
    stroke-width="1.8"
  />
  <circle cx="50" cy="50" r="11" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" />
</svg>`;
  }

  // ── STRING / HTML HELPERS ─────────────────────────────────────

  private emitProofArtifactReady(payload: ProofArtifactReadyPayload): void {
    this.eventBus.emit('PROOF_ARTIFACT_READY', {
      runId: payload.runId,
      exportUrl: payload.exportUrl,
      format: payload.format,
    });
  }

  private extractTagContent(html: string, tagName: 'style' | 'body'): string {
    const match = html.match(
      new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'),
    );
    return match?.[1] ?? '';
  }

  private normalizePlayerHandle(playerHandle: string, fallback: string): string {
    const trimmed = typeof playerHandle === 'string' ? playerHandle.trim() : '';
    return trimmed.length > 0 ? trimmed : fallback;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}