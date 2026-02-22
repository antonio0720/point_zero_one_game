/**
 * BillingContract Interface for PMPM/PEPM/revshare billing models and invoice line item schema.
 */

export interface Partner {
  id: number;
  name: string;
}

export interface InvoiceLineItem {
  id: number;
  partnerId: number;
  billingModel: 'PMPM' | 'PEPM' | 'revshare';
  amount: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface BillingContract {
  id: number;
  partner: Partner;
  startDate: Date;
  endDate?: Date; // optional as contracts can have an end date or be perpetual
  lineItems: InvoiceLineItem[];
}
