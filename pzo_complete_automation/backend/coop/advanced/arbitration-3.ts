interface Player {
id: string;
score: number;
}

class Arbitrator {
private players: Player[];

constructor(players: Player[]) {
this.players = players;
}

sortPlayersByScore() {
return this.players.sort((a, b) => b.score - a.score);
}

findWinner(topN: number): Player | undefined {
const sortedPlayers = this.sortPlayersByScore();
return sortedPlayers.slice(0, topN).pop();
}
}

class Game {
private arbitrator: Arbitrator;

constructor(players: Player[]) {
this.arbitrator = new Arbitrator(players);
}

resolveTie(topN: number): Player | undefined {
return this.arbitrator.findWinner(topN);
}
}
