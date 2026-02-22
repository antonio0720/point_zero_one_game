import { CommerceClient } from '@commerce/commerce';
import { EntitlementClient } from '@entitlements/entitlements';
import Stripe from 'stripe';

const commerce = new CommerceClient({ apiKey: process.env.COMMERCE_API_KEY });
const entitlements = new EntitlementClient({ apiKey: process.env.ENTITLEMENTS_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function purchaseSubscription(customerId: string, productId: string) {
const session = await commerce.checkout.session.create({
customer: customerId,
lineItems: [
{
priceData: {
product: productId,
},
quantity: 1,
},
],
paymentMethodTypes: ['card'],
shippingAddressRequired: false,
});

const checkoutSessionId = session.id;

// Create a Stripe PaymentIntent with the amount and currency from the Commerce Checkout Session
const paymentIntentData = await stripe.paymentIntents.create({
amount: session.amountTotal / 100, // Adjust for currency
currency: session.currencyCode,
confirmation_method: 'manual',
});

const paymentIntentId = paymentIntentData.id;

// Update the Commerce Checkout Session with the Stripe PaymentIntent ID
await commerce.checkout.session.update(checkoutSessionId, {
payment_intent_data: {
intent_id: paymentIntentId,
},
});

const entitlementResponse = await entitlements.entitlements.create({
customerId,
productIds: [productId],
startDate: new Date(),
endDate: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000), // One month subscription
});

return { checkoutSessionId, paymentIntentId, entitlementResponse };
}
