/**
 * Commerce Entitlements — Attachment Service
 * backend/src/services/commerce/entitlements/entitlement_attach.ts
 *
 * Temporary safe replacement for corrupted file content.
 * The previous file contained non-TypeScript prose and a dangling SQL fragment.
 */

export interface PurchaseLike {
  id?: string;
  tag?: string | null;
  skuId?: string | null;
  userId?: string | null;
}

export interface AttachedEntitlementResult {
  purchaseId: string | null;
  tag: string | null;
  status: 'attached' | 'skipped';
  reason?: string;
}

export async function attachEntitlements(
  purchases: PurchaseLike[],
): Promise<AttachedEntitlementResult[]> {
  const results: AttachedEntitlementResult[] = [];

  for (const purchase of purchases) {
    const tag = typeof purchase.tag === 'string' && purchase.tag.trim().length > 0
      ? purchase.tag.trim()
      : null;

    results.push({
      purchaseId: purchase.id ?? null,
      tag,
      status: tag ? 'attached' : 'skipped',
      reason: tag ? undefined : 'missing_tag',
    });
  }

  return results;
}

export default attachEntitlements;
