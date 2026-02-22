import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Purchase, PurchaseDocument } from './schemas/purchase.schema';
import { Entitlement, EntitlementDocument } from '../entitlements/schemas/entitlement.schema';

@Injectable()
export class PurchasesService {
constructor(
@InjectModel(Purchase.name) private purchaseModel: Model<PurchaseDocument>,
@InjectModel(Entitlement.name) private entitlementModel: Model<EntitlementDocument>,
) {}

async createPurchase(userId: string, productId: string, entitlementIds: string[]): Promise<Purchase> {
const user = await this.entitlementModel.findOne({ userId });
if (!user) throw new Error('User not found');

// Check if the user has enough entitlements to make a purchase
let totalEntitlementCost = 0;
for (const entitlementId of entitlementIds) {
const entitlement = await this.entitlementModel.findOne({ _id: entitlementId });
if (!entitlement) throw new Error('Entitlement not found');
totalEntitlementCost += entitlement.price;
}

if (totalEntitlementCost > user.balance) throw new Error('Insufficient balance for the purchase');

// Deduct the cost of entitlements from the user's balance
user.balance -= totalEntitlementCost;
await user.save();

// Create a new purchase document with the product ID and entitlement IDs
const purchase = await this.purchaseModel.create({ userId, productId, entitlementIds });

return purchase;
}
}
