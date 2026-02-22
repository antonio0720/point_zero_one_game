const generator = new ReceiptGenerator();
const receipt: Receipt = { id: '123', amount: 100, date: new Date() };
const jurisdiction = 'US';
const taxedReceipt = generator.generateReceipt(receipt, jurisdiction);
console.log(taxedReceipt); // Outputs { id: '123', amount: 100, date: [Date Object], totalAmount: 107 }
