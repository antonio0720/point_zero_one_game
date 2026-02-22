import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Billing Service', () => {
  let billingService;

  beforeEach(() => {
    // Initialize the billing service for each test
    billingService = new BillingService();
  });

  afterEach(() => {
    // Reset any state or mock dependencies after each test
  });

  describe('Counter Correctness', () => {
    it('should increment the counter correctly on each invoice creation', () => {
      const initialCounter = billingService.getCounter();

      billingService.createInvoice({ amount: 100 });
      expect(billingsService.getCounter()).toEqual(initialCounter + 1);
    });

    it('should not allow duplicate invoice ids', () => {
      const invoiceId = billingService.createInvoice({ amount: 100 }).id;

      expect(() => billingService.createInvoice({ amount: 100, id: invoiceId })).toThrowError('Duplicate invoice id');
    });
  });

  describe('Invoice Idempotency', () => {
    it('should create the same invoice with the same input data', () => {
      const invoice1 = billingService.createInvoice({ amount: 100 });
      const invoice2 = billingService.createInvoice({ amount: 100 });

      expect(invoice1).toEqual(invoice2);
    });

    it('should not modify existing invoices when creating a new one', () => {
      const initialInvoices = billingService.getAllInvoices();
      const newInvoiceData = { amount: 100 };

      billingService.createInvoice(newInvoiceData);

      const finalInvoices = billingService.getAllInvoices();
      expect(finalInvoices).toEqual([...initialInvoices, newInvoiceData]);
    });
  });
});
