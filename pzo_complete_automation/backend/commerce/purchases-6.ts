import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document, Types } from 'mongoose';
import * as _ from 'lodash';
import { PurchaseDocument, Purchase } from './schemas/purchase.schema';
import { EntitlementDocument, Entitlement } from '../entitlements/schemas/entitlement.schema';
import { PurchaseInput } from './dto/purchase-input.dto';
import { PubSub } from 'graphql-subscriptions';

@Injectable()
export class PurchaseService {
constructor(
@InjectModel(Purchase.name) private readonly purchaseModel: Model<Document & Purchase>,
@InjectModel(Entitlement.name) private readonly entitlementModel: Model<Document & Entitlement>,
private readonly pubSub: PubSub,
) {}

async createPurchase(input: PurchaseInput): Promise<PurchaseDocument> {
const { userId, entitlementId } = input;

// Check if the user has an active entitlement
const entitlement = await this.entitlementModel.findOne({ _id: entitlementId, status: 'ACTIVE' }).exec();
if (!entitlement) {
throw new Error('Invalid or expired entitlement');
}

// Check if the user has already purchased the entitlement
const existingPurchase = await this.purchaseModel
.findOne({ userId, entitlementId })
.exec();
if (existingPurchase) {
throw new Error('You have already purchased this entitlement');
}

// Create a new purchase and save it
const newPurchase = await this.purchaseModel.create({ userId, entitlementId });

// Decrement the remaining uses of the entitlement
entitlement.remainingUses -= 1;
await entitlement.save();

// Publish a subscription event for the new purchase
this.pubSub.publish('purchaseCreated', { purchaseCreated: newPurchase });

return newPurchase;
}
}
