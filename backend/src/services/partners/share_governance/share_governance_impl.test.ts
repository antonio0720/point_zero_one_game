import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Share Governance', () => {
  let shareGovernanceService: any;

  beforeEach(() => {
    shareGovernanceService = new ShareGovernanceImpl(); // Assuming ShareGovernanceImpl is the implementation class
  });

  afterEach(() => {
    // Reset any state or mock dependencies as needed for each test
  });

  it('should allow share for tenant and SKU with allowed rule', () => {
    const tenant = 'test_tenant';
    const sku = 'test_sku';
    const rule = { tenant, sku, isAllowed: true };

    const result = shareGovernanceService.checkShareRule(rule);
    expect(result).toBe(true);
  });

  it('should deny share for tenant and SKU with denied rule', () => {
    const tenant = 'test_tenant';
    const sku = 'test_sku';
    const rule = { tenant, sku, isAllowed: false };

    const result = shareGovernanceService.checkShareRule(rule);
    expect(result).toBe(false);
  });

  it('should throw error for unknown tenant', () => {
    const sku = 'test_sku';
    const rule = { tenant: 'unknown_tenant', sku };

    expect(() => shareGovernanceService.checkShareRule(rule)).toThrowError();
  });

  it('should throw error for unknown SKU', () => {
    const tenant = 'test_tenant';
    const rule = { tenant, sku: 'unknown_sku' };

    expect(() => shareGovernanceService.checkShareRule(rule)).toThrowError();
  });

  it('should allow share for tenant and SKU with wildcard tenant', () => {
    const tenant = '*'; // Wildcard tenant
    const sku = 'test_sku';
    const rule = { tenant, sku, isAllowed: true };

    const result = shareGovernanceService.checkShareRule(rule);
    expect(result).toBe(true);
  });

  it('should allow share for tenant and SKU with wildcard SKU', () => {
    const tenant = 'test_tenant';
    const sku = '*'; // Wildcard SKU
    const rule = { tenant, sku, isAllowed: true };

    const result = shareGovernanceService.checkShareRule(rule);
    expect(result).toBe(true);
  });

  it('should deny share for tenant and SKU with wildcard tenant and denied rule', () => {
    const tenant = '*'; // Wildcard tenant
    const sku = 'test_sku';
    const rule = { tenant, sku, isAllowed: false };

    const result = shareGovernanceService.checkShareRule(rule);
    expect(result).toBe(false);
  });

  it('should deny share for tenant and SKU with wildcard SKU and denied rule', () => {
    const tenant = 'test_tenant';
    const sku = '*'; // Wildcard SKU
    const rule = { tenant, sku, isAllowed: false };

    const result = shareGovernanceService.checkShareRule(rule);
    expect(result).toBe(false);
  });
});
