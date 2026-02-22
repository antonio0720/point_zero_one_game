import { GHLWebhookRequest } from './ghl-webhook-request';
import { CustomerService } from '../customer/customer.service';
import { NurturesService } from '../nurtures/nurtures.service';
import { mlEnabled, auditHash } from '../../config';

export class GhlWebhookHandler {
  private readonly customerService: CustomerService;
  private readonly nurturesService: NurturesService;

  constructor(customerService: CustomerService, nurturesService: NurturesService) {
    this.customerService = customerService;
    this.nurturesService = nurturesService;
  }

  async handle(request: GHLWebhookRequest): Promise<void> {
    if (!this.verifyHmacSignature(request)) {
      throw new Error('Invalid HMAC signature');
    }

    switch (request.event) {
      case 'run_complete':
        await this.customerService.updateContact(request);
        break;
      case 'bankruptcy':
        await this.nurturesService.triggerNurtureSequence(request);
        break;
      case 'first_purchase':
        await this.customerService.tagAsCustomer(request);
        break;
    }
  }

  private verifyHmacSignature(request: GHLWebhookRequest): boolean {
    const expectedHash = auditHash(request.timestamp, request.event, request.payload);
    return request.hmacSignature === expectedHash;
  }
}

export function createGhlWebhookHandler(customerService: CustomerService, nurturesService: NurturesService): GhlWebhookHandler {
  if (!mlEnabled) {
    throw new Error('ML models are disabled');
  }

  return new GhlWebhookHandler(customerService, nurturesService);
}
