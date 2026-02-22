import { Client, EntitlementClient } from '@magento/peregrine';
import { PaymentMethodInterface } from '@magento/checkout';
import { Observable, of } from 'rxjs';

class CustomPayment implements PaymentMethodInterface {
constructor(private entitlementClient: EntitlementClient) {}

getCode() {
return 'custom_payment';
}

isActive() {
return this.entitlementCheck().pipe(map(result => result === true));
}

entitlementCheck(): Observable<boolean> {
const customerId = 'YOUR_CUSTOMER_ID';
const entitlementCode = 'YOUR_ENTITLEMENT_CODE';

return this.entitlementClient.checkCustomerEntitlement(customerId, entitlementCode).pipe(
map(result => result.data.status === 'active')
);
}
}

const apiUrl = 'YOUR_API_URL';
const accessToken = 'YOUR_ACCESS_TOKEN';

const commerceClient = Client.withConfig({ url: apiUrl, auth: { access_token: accessToken } });
const entitlementClient = EntitlementClient.withConfig({ url: apiUrl, auth: { access_token: accessToken } });

const paymentMethod = new CustomPayment(entitlementClient);
commerceClient.checkoutData.paymentMethods.addPaymentMethod(paymentMethod).subscribe();
