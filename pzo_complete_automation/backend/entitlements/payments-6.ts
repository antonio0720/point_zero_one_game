import stripe from 'stripe';
import { EntitlementService } from './entitlements-service';

const stripeKey = process.env.STRIPE_API_KEY;
const stripeClient = new stripe(stripeKey);
const entitlementService = new EntitlementService();

export const createPaymentIntent = async (userId: string, amount: number) => {
try {
// Check if user has an active subscription or entitlement
const entitlementResult = await entitlementService.checkEntitlement(userId);

if (!entitlementResult.hasEntitlement) {
throw new Error('User does not have an active entitlement.');
}

// Create a payment intent with the Stripe API
const paymentIntent = await stripeClient.paymentIntents.create({
amount,
currency: 'usd',
metadata: { userId },
});

return paymentIntent;
} catch (error) {
console.error(error);
throw error;
}
};
