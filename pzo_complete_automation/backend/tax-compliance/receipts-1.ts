import moment from 'moment';

class Receipt {
constructor(
public id: string,
public vendorName: string,
public vendorTaxID: string,
public customerName: string,
public customerTaxID: string,
public itemDescription: string,
public quantity: number,
public unitPrice: number,
public discountPercentage: number,
public totalAmountBeforeDiscount: number,
public totalAmountAfterDiscount: number,
public taxRate: number,
public taxAmount: number,
public subtotalAmount: number,
public totalAmount: number,
public dateCreated: Date
) {}

calculateSubtotals(): void {
this.subtotalAmount = this.quantity * this.unitPrice;
this.totalAmountBeforeDiscount = this.subtotalAmount * (1 - (this.discountPercentage / 100));
this.totalAmountAfterDiscount = this.totalAmountBeforeDiscount - this.taxAmount;
}
}
