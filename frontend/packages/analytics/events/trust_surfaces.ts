/**
 * Trust Surfaces Event Handlers
 */

declare global {
  interface Window {
    analytics?: any;
  }
}

export function initAnalytics() {
  if (!window.analytics) {
    window.analytics = new AnalyticsClient();
  }
}

export class AnalyticsClient {
  private readonly client: any;

  constructor() {
    this.client = new AnalyticsAdapter();
  }

  trackShareClick(eventId: string) {
    this.client.track('share_click', { event_id: eventId });
  }

  trackCopyAction(eventId: string, copiedText: string) {
    this.client.track('copy_action', { event_id: eventId, copied_text: copiedText });
  }

  trackExplorerInteraction(eventId: string, explorerId: string, action: string) {
    this.client.track('explorer_interaction', { event_id: eventId, explorer_id: explorerId, action });
  }

  // Analytics Adapter interface for mocking during testing
  static registerAdapter(adapter: any) {
    AnalyticsAdapter = adapter;
  }
}

class AnalyticsAdapter {
  track(eventName: string, properties: any) {
    // Implement tracking logic here
  }
}
