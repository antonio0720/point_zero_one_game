// tslint:disable:no-any strict-type-checking no-console
import { Request } from 'express';
import { StripeWebhookVerifyResponse } from './stripe-webhook-verify-response';
import { GHLWebhookVerifyResponse } from './ghl-webhook-verify-response';
import { SubscriptionVerifyRequest } from './subscription-verify-request';
import { SubscriptionVerifyResponse } from './subscription-verify-response';

export function subscriptionVerify(req: Request): Promise<SubscriptionVerifyResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('Missing Stripe Webhook Secret');
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return Promise.reject(new Error('Missing Stripe Signature'));
  }

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
  } catch (err) {
    console.error(err);
    return Promise.reject(new Error('Invalid Stripe Webhook Signature'));
  }

  const subscriptionVerifyRequest = new SubscriptionVerifyRequest(event);

  if (subscriptionVerifyRequest.isGHL()) {
    return ghlWebhookVerify(req, event);
  }

  return stripeWebhookVerify(req, event);
}

function stripeWebhookVerify(req: Request, event: any): Promise<StripeWebhookVerifyResponse> {
  const subscription = event.data.object as Stripe.Subscription;
  if (!subscription) {
    throw new Error('Missing Stripe Subscription');
  }

  const subscriptionVerifyRequest = new SubscriptionVerifyRequest(event);

  return new Promise((resolve, reject) => {
    // tslint:disable-next-line:no-console
    console.log(`Received Stripe Webhook Verify Event: ${JSON.stringify(subscriptionVerifyRequest)}`);

    if (subscription.status === 'active') {
      resolve(new StripeWebhookVerifyResponse(true));
    } else {
      resolve(new StripeWebhookVerifyResponse(false));
    }
  });
}

function ghlWebhookVerify(req: Request, event: any): Promise<GHLWebhookVerifyResponse> {
  const subscription = event.data.object as GHL.Subscription;
  if (!subscription) {
    throw new Error('Missing GHL Subscription');
  }

  const subscriptionVerifyRequest = new SubscriptionVerifyRequest(event);

  return new Promise((resolve, reject) => {
    // tslint:disable-next-line:no-console
    console.log(`Received GHL Webhook Verify Event: ${JSON.stringify(subscriptionVerifyRequest)}`);

    if (subscription.status === 'active') {
      resolve(new GHLWebhookVerifyResponse(true));
    } else {
      resolve(new GHLWebhookVerifyResponse(false));
    }
  });
}

export class SubscriptionVerifyRequest {
  private event: any;

  constructor(event: any) {
    this.event = event;
  }

  isGHL(): boolean {
    return this.event.type === 'invoice.paid' && this.event.data.object.type === 'subscription';
  }
}

export class StripeWebhookVerifyResponse {
  public isValid: boolean;

  constructor(isValid: boolean) {
    this.isValid = isValid;
  }
}

export class GHLWebhookVerifyResponse {
  public isValid: boolean;

  constructor(isValid: boolean) {
    this.isValid = isValid;
  }
}

export class SubscriptionVerifyResponse {
  public isValid: boolean;
  public auditHash: string;

  constructor(isValid: boolean, auditHash: string) {
    this.isValid = isValid;
    this.auditHash = auditHash;
  }
}
