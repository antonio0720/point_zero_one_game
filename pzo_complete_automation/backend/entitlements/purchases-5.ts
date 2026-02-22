import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { web } from '@google-pay/api-core';
import { PurchaseFlowResult, PurchaseParams, getGooglePayApi } from '@google-pay/purchases-web';

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

exports.handlePurchase = functions.https.onCall(async (data: any, context) => {
if (!context.auth) {
throw new Error('Unauthenticated');
}

const userId = context.auth.uid;
const productId = data.productId;
const purchaseParams: PurchaseParams = {
apiVersion: 2,
allowedPaymentMethods: [
{
type: 'CARD',
parameters: {
allowPrepaidCards: true,
billingAddressRequired: false,
shippingAddressRequired: false,
expirationYearMin: new Date().getFullYear() + 1,
expirationYearMax: new Date().getFullYear() + 5,
},
},
],
merchantInfo: {
merchantId: 'merchant_id', // Your Google Pay Merchant ID
merchantName: 'Your App Name',
totalPriceStatus: 'final',
},
requestId: Date.now().toString(),
itemList: {
itemCount: 1,
items: [
{
id: productId,
title: `Product ${productId}`, // Your Product Title
description: `Description of Product ${productId}`, // Your Product Description
price: {
currencyCode: 'USD',
value: '9.99', // Set your product price in USD (or change it as needed)
},
},
],
},
};

try {
const api = await getGooglePayApi(web);
const result: PurchaseFlowResult = await api.purchaseFlow({ request: purchaseParams });

if (result.error) {
throw new Error(result.error.message);
}

// Save the purchase data to Firestore
db.collection('users').doc(userId).collection('entitlements').doc(productId).set({
purchaseToken: result.purchaseToken,
originalJson: JSON.stringify(result),
timestamp: admin.firestore.FieldValue.serverTimestamp(),
});

return { success: true };
} catch (error) {
console.error(error);
throw error;
}
});
