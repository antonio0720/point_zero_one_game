export interface Currency {
id: string;
name: string;
symbol: string;
decimalPlaces: number;
}

const currencies: Record<string, Currency> = {
USD: { id: 'USD', name: 'United States Dollar', symbol: '$', decimalPlaces: 2 },
EUR: { id: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
JPY: { id: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalPlaces: 0 },
GBP: { id: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2 },
CNY: { id: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimalPlaces: 2 }
};

export function getCurrency(id: string): Currency | undefined {
return currencies[id];
}
