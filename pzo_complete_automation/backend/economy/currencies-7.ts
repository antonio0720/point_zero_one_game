export class Currency {
code: string;
name: string;
exchangeRate: number;
balance: number;

constructor(code: string, name: string, exchangeRate: number) {
this.code = code;
this.name = name;
this.exchangeRate = exchangeRate;
this.balance = 0;
}

deposit(amount: number): void {
this.balance += amount;
}

withdraw(amount: number): void {
if (this.balance < amount) throw new Error('Insufficient balance');
this.balance -= amount;
}
}
