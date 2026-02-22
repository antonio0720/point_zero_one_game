import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm-extension/dist';
import { Player } from './Player';

@Entity()
export class Game {
@PrimaryGeneratedColumn()
id: number;

@Column({ type: 'varchar' })
name: string;

@ManyToOne(() => Player, (player) => player.games, { onDelete: 'CASCADE' })
@JoinColumn()
owner: Player;
}
