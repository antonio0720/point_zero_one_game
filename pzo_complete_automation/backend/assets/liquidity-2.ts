import { BehaviorSubject, Observable } from 'rxjs';
import { tap, map, filter } from 'rxjs/operators';

class MarketOrder {
price: number;
quantity: number;
side: string;

constructor(price: number, quantity: number, side: string) {
this.price = price;
this.quantity = quantity;
this.side = side;
}
}

class LimitOrder {
price: number;
quantity: number;
side: string;

constructor(price: number, quantity: number, side: string) {
this.price = price;
this.quantity = quantity;
this.side = side;
}
}

class FillOrder {
price: number;
quantity: number;
side: string;

constructor(price: number, quantity: number, side: string) {
this.price = price;
this.quantity = quantity;
this.side = side;
}
}

class Liquidity2 {
bidStream$ = new BehaviorSubject<number>(0);
askStream$ = new BehaviorSubject<number>(0);
bestBid$: Observable<number>;
bestAsk$: Observable<number>;

constructor() {
this.bestBid$ = this.bidStream$.pipe(
map((bid) => Math.min(...Array.from(this.bidStream_.values()))),
tap(() => console.log('Best bid:', this.bestBid$))
);

this.bestAsk$ = this.askStream$.pipe(
map((ask) => Math.max(...Array.from(this.askStream_.values()))),
tap(() => console.log('Best ask:', this.bestAsk$))
);
}

addMarketOrder(order: MarketOrder) {
const side = order.side === 'buy' ? this.bidStream_ : this.askStream_;
side.next(order.price);
}

addLimitOrder(order: LimitOrder) {
if (order.side === 'buy') {
this.askStream_.pipe(
filter((ask) => ask >= order.price),
tap((ask) => this.addFillOrder(new FillOrder(ask, order.quantity, order.side)))
).subscribe();
} else {
this.bidStream_.pipe(
filter((bid) => bid <= order.price),
tap((bid) => this.addFillOrder(new FillOrder(bid, order.quantity, order.side)))
).subscribe();
}
}

private addFillOrder(order: FillOrder) {
console.log(`Filled order: ${JSON.stringify(order)}`);
const side = order.side === 'buy' ? this.bidStream_ : this.askStream_;
if (order.quantity > 0) {
side.next(order.price - order.quantity);
} else if (order.quantity < 0) {
side.next(order.price + Math.abs(order.quantity));
}
}
}
