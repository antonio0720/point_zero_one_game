import { Currency } from './Currency';
import { Player } from './Player';

export class GameManager {
private currencies: Map<string, Currency> = new Map();
private players: Map<number, Player> = new Map();

addCurrency(currency: Currency) {
this.currencies.set(currency.id, currency);
}

getCurrency(id: string): Currency | null {
return this.currencies.get(id) || null;
}

addPlayer(player: Player) {
this.players.set(player.id, player);
}

getPlayer(id: number): Player | null {
return this.players.get(id) || null;
}

transferCurrency(fromId: number, toId: number, currencyId: string, amount: number) {
const fromPlayer = this.getPlayer(fromId);
if (!fromPlayer) return null;

const toPlayer = this.getPlayer(toId);
if (!toPlayer) return null;

const currency = this.getCurrency(currencyId);
if (!currency) return null;

const fromAmount = fromPlayer.balance.get(currencyId) || 0;
if (fromAmount < amount) return null;

fromPlayer.balance.set(currencyId, fromAmount - amount);
toPlayer.balance.set(currencyId, (toPlayer.balance.get(currencyId) || 0) + amount);

currency.onTransfer(fromPlayer, toPlayer, amount);

return { fromPlayer, toPlayer, amount };
}
}

export class Currency {
constructor(public id: string, public name: string, public symbol: string) {}

onTransfer(from: Player, to: Player, amount: number) {
console.log(`Transfered ${amount} ${this.symbol} from ${from.name} to ${to.name}`);
}
}

export class Player {
constructor(public id: number, public name: string, public balance: Map<string, number> = new Map()) {}
}
