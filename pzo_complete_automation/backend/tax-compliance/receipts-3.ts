import { ReceiptItem } from './receipt-item';

interface Product {
id: string;
name: string;
price: number;
}

class ProductRepositoryInMemory implements ProductRepository {
private products: Map<string, Product> = new Map();

addProduct(product: Product) {
this.products.set(product.id, product);
}

getProduct(id: string): Product | undefined {
return this.products.get(id);
}
}

interface Receipt {
id: string;
items: ReceiptItem[];
total: number;
}

class ReceiptGenerator {
private productRepository: ProductRepository;

constructor(productRepository: ProductRepository) {
this.productRepository = productRepository;
}

generateReceipt(items: string[]): Receipt {
const receipt: Receipt = {
id: new Date().toISOString(),
items: [],
total: 0,
};

for (const itemId of items) {
const product = this.productRepository.get(itemId);
if (!product) {
throw new Error(`Product with id ${itemId} not found`);
}

const receiptItem: ReceiptItem = {
product,
quantity: 1,
};

receipt.items.push(receiptItem);
receipt.total += product.price;
}

return receipt;
}
}

interface ProductRepository {
addProduct(product: Product): void;
getProduct(id: string): Product | undefined;
}

// Example usage
const productRepository = new ProductRepositoryInMemory();
productRepository.addProduct({ id: '1', name: 'Product A', price: 10 });
productRepository.addProduct({ id: '2', name: 'Product B', price: 20 });

const receiptGenerator = new ReceiptGenerator(productRepository);
const receipt = receiptGenerator.generateReceipt(['1', '2']);
console.log(receipt);
