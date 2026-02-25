/**
 * Attach entitlements on purchase. If tag missing/mis-tagged, mark as 'unranked_only' until verified and receipts are provided.
 */

import { Entitlement, Purchase } from "../models";

export async function attachEntitlements(purchases: Purchase[]): Promise<void> {
  for (const purchase of purchases) {
    const entitlement = await Entitlement.findOne({ where: { tag: purchase.tag } });

    if (!entitlement) {
      await Entitlement.create({ tag: purchase.tag, rank: "unranked_only" });
    } else if (entitlement.rank !== "ranked") {
      entitlement.rank = "ranked";
      await entitlement.save();
    }
  }
}


- SQL:

