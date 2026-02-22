interface Game {
resources: {
gold: number;
mana: number;
};
}

function applyRebalancePulse(game: Game): Game {
const { resources } = game;

// Rebalancing formulas, adjust according to your game's needs
const goldMultiplier = 0.95;
const manaMultiplier = 1.05;

resources.gold *= goldMultiplier;
resources.mana *= manaMultiplier;

return { ...game, resources };
}
