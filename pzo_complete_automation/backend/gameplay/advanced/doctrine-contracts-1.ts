import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Player } from "./Player";

@Entity()
export class Game {
@PrimaryGeneratedColumn()
id: number;

@ManyToOne(() => Player, player => player.games)
@JoinColumn()
player: Player;

@Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
startTime: Date;

@Column()
status: string;
}
