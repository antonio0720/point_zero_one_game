import { createTaxEngine } from "../tax-engine";
import { SalesTaxRule } from "../sales-tax-rules/sales-tax-rule";
import { State } from "./state";
import { Product } from "../product";
import { assert } from "chai";

describe("Sales Tax 4", () => {
const taxEngine = createTaxEngine([
new SalesTaxRule(new State("TX"), new Product("book"), 0.05),
new SalesTaxRule(new State("MA"), new Product("book"), 0.05),
new SalesTaxRule(new State("CA"), new Product("food"), 0.1),
]);

it("should calculate correct tax for Texas book", () => {
const product = new Product("book");
const state = new State("TX");
const price = product.price * (1 + 0.05);
assert.equal(taxEngine.calculateTax(product, state), price - product.price);
});

it("should calculate correct tax for Massachusetts book", () => {
const product = new Product("book");
const state = new State("MA");
const price = product.price * (1 + 0.05);
assert.equal(taxEngine.calculateTax(product, state), price - product.price);
});

it("should calculate correct tax for California food", () => {
const product = new Product("food");
const state = new State("CA");
const price = product.price * (1 + 0.1);
assert.equal(taxEngine.calculateTax(product, state), price - product.price);
});
});
