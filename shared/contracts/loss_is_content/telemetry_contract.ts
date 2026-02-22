/**
 * LossIsContent Telemetry Contract
 */

declare module '@pointzeroonedigital/loss-is-content' {
  export interface TelemetryEvent {
    death_package_shown?: boolean;
    share_clicked?: boolean;
    fork_started?: boolean;
    training_started?: boolean;
    next_run_started?: boolean;
  }

  export function trackTelemetry(event: TelemetryEvent): void;
}
