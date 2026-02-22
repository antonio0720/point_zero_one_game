import { EntitlementServiceClient } from '@google-cloud/entitlement';
import { Receipt } from './Receipt';
import { calculateTotalPrice, calculateTax } from './pricing';

const entitlement = new EntitlementServiceClient();

async function generateReceipt(items: Array<{ productId: string; quantity: number; pricePerUnit: number }>) {
const totalPrice = calculateTotalPrice(items);
const taxAmount = calculateTax(totalPrice);

// Fetch entitlement for the transaction.
const [response] = await entitlement.fetch({});
const entitlementId = response[0].entitlementId;

const receipt = new Receipt();
receipt.id = Math.random().toString(36).substring(7);
receipt.items = items.map((item) => ({
productId: item.productId,
name: `Product ${item.productId}`,
pricePerUnit: item.pricePerUnit,
quantity: item.quantity,
}));
receipt.totalPrice = totalPrice;
receipt.taxAmount = taxAmount;
receipt.entitlementId = entitlementId;

return receipt;
}
