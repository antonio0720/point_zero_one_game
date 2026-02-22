import moment from 'moment';

interface Item {
name: string;
price: number;  // in local currency (e.g., USD)
}

interface Receipt {
id: string;
items: Item[];
totalPrice: number;
taxAmount: number;
timestamp: moment.Moment;
}

function createReceipt(items: Item[], customerId?: string): Receipt {
const totalPrice = items.reduce((acc, item) => acc + item.price, 0);
const taxAmount = (totalPrice * 10) / 100; // 10% sales tax
const receipt: Receipt = {
id: generateUniqueId(), // Implement a function to generate unique IDs
items,
totalPrice,
taxAmount,
timestamp: moment().utc(),
};

if (customerId) {
receipt.customerId = customerId;
}

return receipt;
}

// Optional: Implement a function to generate unique IDs
function generateUniqueId(): string {
// ...
}
