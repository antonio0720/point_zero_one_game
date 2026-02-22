import { TaxRate } from './TaxRate';
import { ReceiptItem } from './ReceiptItem';

export class Receipt {
private _items: ReceiptItem[];
private _subtotal: number;
private _vatRate: TaxRate;
private _total: number;

constructor(items: ReceiptItem[], vatRate: TaxRate) {
this._items = items;
this._subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
this._vatRate = vatRate;
this._total = this.calculateTotal();
}

public get items(): ReceiptItem[] {
return this._items;
}

public get subtotal(): number {
return this._subtotal;
}

public get vatRate(): TaxRate {
return this._vatRate;
}

public get total(): number {
return this._total;
}

private calculateTotal(): number {
const vatAmount = (this.subtotal * this.vatRate.rate) / 100;
return this.subtotal + vatAmount;
}

public validate(): void {
if (!Array.isArray(this._items)) throw new Error('Invalid receipt items');
if (this._items.length === 0) throw new Error('Receipt must contain at least one item');
this._items.forEach((item) => {
if (item.price <= 0 || item.quantity < 1) throw new Error(`Invalid receipt item: ${JSON.stringify(item)}`);
});
}
}

export class TaxRate {
constructor(public readonly name: string, public readonly rate: number) {}
}

export class ReceiptItem {
constructor(public readonly id: string, public readonly description: string, public readonly price: number, public quantity: number = 1) {}
}
