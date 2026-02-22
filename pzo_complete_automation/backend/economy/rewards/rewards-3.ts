const economyEngine = new EconomyEngine();
const reward1 = new Reward(1, 'Gold Medal', 100);
const reward2 = new Reward(2, 'Silver Medal', 50);
const player1 = new Player('John Doe');
const player2 = new Player('Jane Smith');

economyEngine.addReward(reward1);
economyEngine.addReward(reward2);
economyEngine.addPlayer(player1);
economyEngine.addPlayer(player2);

economyEngine.distributeRewards();

console.log(`John Doe's balance: ${player1.balance}`);
console.log(`Jane Smith's balance: ${player2.balance}`);
