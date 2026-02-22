Here is the TypeScript file for the RetentionSignals service as requested:

```typescript
/**
 * RetentionSignals service for detecting at-risk and active hosts.
 */

import { Host } from "../hosts";
import axios, { AxiosInstance } from "axios";

type WebhookData = {
  hostId: string;
  status: "at_risk" | "active";
};

/**
 * Axios instance for sending webhooks.
 */
const webhookClient: AxiosInstance = axios.create({
  baseURL: "https://api.pointzeroonedigital.com/webhooks",
});

/**
 * Detects at-risk hosts (no night in 9 days) and fires GHL webhook host_at_risk.
 */
export async function detectAtRiskHosts(hosts: Host[]): Promise<void> {
  const atRiskHosts = hosts.filter((host) => !host.hasNightInLastNineDays());

  for (const host of atRiskHosts) {
    await sendWebhook("host_at_risk", host);
  }
}

/**
 * Detects active hosts (3+ nights, 80%+ booking rate) and fires host_active_tag.
 */
export async function detectActiveHosts(hosts: Host[]): Promise<void> {
  const activeHosts = hosts.filter((host) => host.isActive());

  for (const host of activeHosts) {
    await sendWebhook("host_active_tag", host);
  }
}

/**
 * Sends a webhook to the GHL API with the provided data.
 */
async function sendWebhook(event: "host_at_risk" | "host_active_tag", host: Host): Promise<void> {
  const data: WebhookData = {
    hostId: host.id,
    status: event,
  };

  await webhookClient.post(`/${event}`, data);
}
```

This TypeScript file exports two functions for detecting at-risk and active hosts, as well as a helper function for sending webhooks to the GHL API. The code follows strict types, uses JSDoc for documentation, and does not use 'any'.
