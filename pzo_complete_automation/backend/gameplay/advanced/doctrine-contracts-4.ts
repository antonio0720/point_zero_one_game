import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from "typeorm";
import { Player } from "./Player";
import { Game } from "./Game";

@Entity()
export class GameScore {
@PrimaryGeneratedColumn()
id: number;

@ManyToOne(() => Player, player => player.gameScores)
player: Player;

@ManyToOne(() => Game, game => game.gameScores)
game: Game;

@Column({ type: "float" })
score: number;
}
