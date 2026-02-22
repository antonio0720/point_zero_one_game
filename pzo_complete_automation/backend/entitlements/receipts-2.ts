import * as commerce from '@bigcommerce/commerce-js';
import * as ReceiptValidation from 'apple-receipt-validator-js';

// Initialize BigCommerce API client
const apiClient = new commerce.ApiClientBuilder('YOUR_API_URL')
.withApiKey('YOUR_API_KEY')
.build();

// Initialize Receipt Validator
const validator = new ReceiptValidation.AppleReceiptValidator({
merchantId: 'YOUR_APPLE_MERCHANDISER_ID',
});

async function validateReceipt(receiptData: any) {
try {
const isValid = await validator.validate(receiptData);

if (isValid) {
// Call BigCommerce API to verify the receipt
const response = await apiClient.post('checkout/entitlements/verify', {
customerId: 'CUSTOMER_ID',
entitlement: JSON.stringify({
receiptData,
productCode: 'PRODUCT_CODE',
transactionId: receiptData.receipt['transaction-id'],
}),
});

if (response.success) {
// Successful verification
console.log('Entitlement verified successfully');
} else {
console.error('Failed to verify entitlement', response.message);
}
} else {
console.error('Receipt validation failed');
}
} catch (e) {
console.error('An error occurred:', e);
}
}

// Call the validateReceipt function with your receipt data
validateReceipt({ receipt: YOUR_RECEIPT_DATA });
