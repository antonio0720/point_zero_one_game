interface Player {
id: number;
battlePassLevel: number;
experiencePoints: number;
}

enum BattlePassTier {
FREE = "Free",
BRONZE = "Bronze",
SILVER = "Silver",
GOLD = "Gold",
DIAMOND = "Diamond"
}

interface Reward {
tier: BattlePassTier;
rewards: string[]; // replace with actual reward objects or strings
}

const battlePassRewards: Reward[] = [
{
tier: BattlePassTier.BRONZE,
rewards: ["Item1", "Item2"],
},
// Add more tiers and rewards as needed
];

function gainExperience(player: Player, points: number) {
player.experiencePoints += points;

while (player.experiencePoints >= 100) {
player.battlePassLevel++;
player.experiencePoints -= 100;
}
}

function upgradeBattlePass(player: Player) {
if (player.battlePassLevel < battlePassRewards.length) {
gainExperience(player, 100);
} else {
console.log(`Player ${player.id} has reached the max Battle Pass level`);
}

if (player.battlePassLevel <= battlePassRewards.length && player.battlePassLevel % 5 === 0) {
console.log(
`Player ${player.id} has reached Tier ${battlePassRewards[player.battlePassLevel - 1].tier}`
);
for (const reward of battlePassRewards[player.battlePassLevel - 1].rewards) {
console.log(`Player received reward: ${reward}`);
}
}
}
