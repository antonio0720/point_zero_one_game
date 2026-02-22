/**
 * Emits integrity telemetry on page view and CTA clicks, including source surface.
 */

import { TelemetryEvent } from '../../telemetry';
import { PageViewEvent, CtaClickEvent } from '../events';

export class IntegrityTelemetry {
  private readonly sourceSurface: string;

  constructor(sourceSurface: string) {
    this.sourceSurface = sourceSurface;
  }

  public trackPageView(): void {
    const event: TelemetryEvent = new PageViewEvent({ sourceSurface: this.sourceSurface });
    emitTelemetry(event);
  }

  public trackCtaClick(): void {
    const event: TelemetryEvent = new CtaClickEvent({ sourceSurface: this.sourceSurface });
    emitTelemetry(event);
  }

  private static emitTelemetry(event: TelemetryEvent): void {
    // Implement the logic to emit the telemetry event here.
  }
}
