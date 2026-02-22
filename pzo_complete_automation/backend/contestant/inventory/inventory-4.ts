import { Contestant } from './contestant';
import { Product } from './product';

export class Inventory {
private contestants: Map<number, Contestant> = new Map();
private products: Map<string, Product> = new Map();

addContestant(id: number, name: string, age: number): void {
const contestant = new Contestant(id, name, age);
this.contestants.set(id, contestant);
}

getContestantById(id: number): Contestant | undefined {
return this.contestants.get(id);
}

addProduct(code: string, name: string, price: number): void {
const product = new Product(code, name, price);
this.products.set(code, product);
}

getProductByCode(code: string): Product | undefined {
return this.products.get(code);
}

purchaseProduct(contestantId: number, productCode: string): void {
const contestant = this.getContestantById(contestantId);
if (!contestant) return;

const product = this.getProductByCode(productCode);
if (!product) return;

contestant.purchaseProduct(product);
}
}

class Contestant {
private id: number;
private name: string;
private age: number;
private products: Set<Product> = new Set();

constructor(id: number, name: string, age: number) {
this.id = id;
this.name = name;
this.age = age;
}

purchaseProduct(product: Product): void {
this.products.add(product);
}
}

class Product {
private code: string;
private name: string;
private price: number;

constructor(code: string, name: string, price: number) {
this.code = code;
this.name = name;
this.price = price;
}
}
