/**
 * AfterScreen Payload Interface
 */
export interface AfterScreenPayload {
  causeSummary?: string;
  insight?: string;
  deltaHighlight?: string[];
  ctaActions?: CTAAction[];
}

/**
 * Call to Action (CTA) Action Interface
 */
export interface CTAAction {
  label: string;
  url: string;
}
