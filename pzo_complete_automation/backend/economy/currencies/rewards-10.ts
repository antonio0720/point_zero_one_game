class Economy {
private currencies: Record<string, Currency> = {};

constructor() {
this.currencies["gold"] = new Currency("Gold", 1);
this.currencies["diamonds"] = new Currency("Diamonds", 10);
}

addCurrency(name: string, multiplier: number) {
this.currencies[name] = new Currency(`${name} (${multiplier})`, multiplier);
}

removeCurrency(name: string) {
delete this.currencies[name];
}

rewardPlayer(playerId: string, currencyName: string, amount: number) {
const currency = this.currencies[currencyName];
if (!currency) throw new Error(`Currency "${currencyName}" not found.`);

this.adjustPlayerBalance(playerId, currencyName, amount);
}

deductPlayer(playerId: string, currencyName: string, amount: number) {
const currency = this.currencies[currencyName];
if (!currency) throw new Error(`Currency "${currencyName}" not found.`);

this.adjustPlayerBalance(playerId, currencyName, -amount);
}

private adjustPlayerBalance(playerId: string, currencyName: string, amount: number) {
let player = this.getPlayer(playerId);
if (!player[currencyName]) player[currencyName] = 0;

player[currencyName] += amount;
}

private getPlayer(playerId: string): Record<string, any> {
if (!this.players[playerId]) this.players[playerId] = {};
return this.players[playerId];
}

private players: Record<string, Record<string, number>> = {};
}

class Currency {
name: string;
multiplier: number;

constructor(name: string, multiplier: number) {
this.name = name;
this.multiplier = multiplier;
}

displayBalance(balance: number): string {
return `${balance * this.multiplier}`;
}
}
