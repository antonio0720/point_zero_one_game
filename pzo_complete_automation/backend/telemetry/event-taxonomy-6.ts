export interface TelemetryEvent {
eventId: string;
eventName: string;
eventCategory?: string;
eventAction?: string;
eventLabel?: string;
eventValue?: number;
userProperties?: Record<string, any>;
contextProperties?: Record<string, any>;
}

export const EventTaxonomyVersion6 = {
events: [
// Define your events here, for example:
{
eventId: '1',
eventName: 'User Signed Up',
eventCategory: 'Authentication',
eventAction: 'SignUp',
},
{
eventId: '2',
eventName: 'Item Purchased',
eventCategory: 'Ecommerce',
eventAction: 'Purchase',
eventLabel: 'Product ID',
eventValue: (value: number) => value,
},
],
};
