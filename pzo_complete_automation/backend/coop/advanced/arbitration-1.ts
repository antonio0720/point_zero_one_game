interface Player {
id: number;
balance: number;
makeOffer(playerId: number, amount: number): void;
}

class Arbitrator {
private players: Map<number, Player>;

constructor() {
this.players = new Map();
}

registerPlayer(player: Player) {
this.players.set(player.id, player);
}

mediateOffer(offerorId: number, offereeId: number, amount: number): void {
const offeror = this.players.get(offerorId);
const offeree = this.players.get(offereeId);

if (!offeror || !offeree) {
throw new Error('One or both players not found');
}

if (offeror.balance < amount) {
throw new Error('Offeror does not have enough coins');
}

offeree.balance += amount;
offeror.balance -= amount;
}
}
