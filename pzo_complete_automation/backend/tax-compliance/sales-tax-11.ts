interface Product {
price: number;
}

interface State {
name: string;
salesTaxRate: number;
}

class SalesTaxCalculator {
private stateRates: { [key: string]: number } = {
CA: 0.06, // California
NY: 0.0825, // New York
TX: 0.0825, // Texas
FL: 0.06, // Florida
// Add more states as needed
};

calculateSalesTax(product: Product, state: State): number {
const rate = this.stateRates[state.name] || 0;
return product.price * rate;
}
}

const calculator = new SalesTaxCalculator();

interface OrderItem {
product: Product;
quantity: number;
}

interface Order {
items: OrderItem[];
state: State;
}

function calculateTotalSalesTax(order: Order): number {
let total = 0;
order.items.forEach((item) => {
total += calculator.calculateSalesTax(item.product, order.state);
});
return total;
}
