// backend/src/types/billing.types.ts

export type BillingCurrency = 'USD' | 'EUR' | 'GBP';
export type BillingInterval = 'monthly' | 'quarterly' | 'yearly' | 'one_time';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void' | 'overdue';
export type RevshareStatus = 'active' | 'paused' | 'terminated';
export type PayoutFrequency = 'monthly' | 'quarterly' | 'yearly';

export interface BillingPlanRecord {
  id: number;
  code: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: BillingCurrency;
  billingInterval: BillingInterval;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceRecord {
  id: number;
  accountId: number;
  billingPlanId: number | null;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: BillingCurrency;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  externalReference: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItemRecord {
  id: number;
  invoiceId: number;
  lineNumber: number;
  sku: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UsageCounterRecord {
  id: number;
  accountId: number;
  billingPlanId: number | null;
  metricKey: string;
  windowStart: string;
  windowEnd: string;
  usageUnits: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RevsharePartnerRecord {
  id: number;
  accountId: number;
  partnerAccountId: number;
  revenueSplitBps: number;
  status: RevshareStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutScheduleRecord {
  id: number;
  revsharePartnerId: number;
  paymentMethod: string;
  frequency: PayoutFrequency;
  amountCents: number;
  startAt: string;
  endAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}