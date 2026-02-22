import { createConnection, ConnectionOptions } from "@doctrinejs/core";
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "@doctrinejs/entity-mapper";
import { Game, Player, GamePlayer } from "./entities";

const config: ConnectionOptions = {
driver: "sqlite",
database: ":memory:",
logging: false, // Set to true for debugging purposes
};

createConnection(config).then(async connection => {
await connection.synchronize();

class Game extends Entity {}
Game.addMapping({
id: "@id",
name: "",
});

class Player extends Entity {}
Player.addMapping({
id: "@id",
name: "",
});

class GamePlayer extends Entity {
@ManyToOne(() => Game)
@JoinColumn()
game!: Game;

@ManyToOne(() => Player)
@JoinColumn()
player!: Player;
}

GamePlayer.addMapping({
id: "@id",
game_id: { type: "int", nullable: false },
player_id: { type: "int", nullable: false },
});

await connection.manager.create(Game, [{ name: "Example Game" }]);
const player1 = await connection.manager.create(Player, { name: "John Doe" });
const player2 = await connection.manager.create(Player, { name: "Jane Smith" });

const gamePlayer = await connection.manager.create(GamePlayer, {
game_id: 1,
player_id: player1.id,
});

await connection.manager.save(gamePlayer);

const savedGamePlayer = await connection.manager.findOne(GamePlayer, { where: [gamePlayer] });
console.log(savedGamePlayer);

await connection.close();
});
