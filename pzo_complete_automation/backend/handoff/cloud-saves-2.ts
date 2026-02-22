import { v4 as uuidv4 } from 'uuid';

interface GameData {
id: string;
player1?: PlayerData;
player2?: PlayerData;
}

interface PlayerData {
name: string;
score: number;
}

const saveGame = (gameId: string, playerData: Partial<PlayerData>) => {
const game = getGame(gameId);

if (!game) {
createGame(gameId);
}

if (playerData.name && !game[`player${Number(game.id.charAt(1))}`].name) {
game[`player${Number(game.id.charAt(1))}`] = playerData;
} else if (playerData.score) {
game[`player${Number(game.id.charAt(1))}`].score += playerData.score;
}

saveToCloud(game);
};

const getGame = (gameId: string): GameData | null => {
// Load the game from a database or cloud storage
const gameFromStorage = // ...
return gameFromStorage || null;
};

const createGame = (gameId: string) => {
const newGame: GameData = { id: gameId, player1: {}, player2: {} };
saveToCloud(newGame);
};

const saveToCloud = (game: GameData) => {
// Save the game to cloud storage
// ...
};

const getHandoffGameId = () => {
const currentPlayer = getActivePlayer();
if (!currentPlayer || !currentPlayer.id) return null;

const activePlayersGameId = getGame(currentPlayer.id);
if (!activePlayersGameId) return null;

// If both players have played, start a new game
if (activePlayersGameId.player1 && activePlayersGameId.player2) {
const newGameId = uuidv4();
saveGame(newGameId, {}); // Empty object to create a new game without initial player data
return newGameId;
}

// If only one player has played, handoff the existing game
return activePlayersGameId.id;
};

const getActivePlayer = () => {
const currentPlayerId = localStorage.getItem('currentPlayer');
if (!currentPlayerId) return null;

const currentPlayerData = JSON.parse(localStorage.getItem(currentPlayerId) || '{}');
return { id: currentPlayerId, ...currentPlayerData };
};
