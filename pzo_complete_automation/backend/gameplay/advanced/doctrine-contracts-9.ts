import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { GameEntity } from "./game-entity";
import { IGameRepository } from "../repositories/IGameRepository";
import { DoctrineGameRepository } from "../repositories/DoctrineGameRepository";
import { IMovementStrategy } from "../movement-strategies/IMovementStrategy";
import { BasicMovementStrategy } from "../movement-strategies/BasicMovementStrategy";

@Entity()
export class Game implements IGame {
@PrimaryGeneratedColumn()
id: number;

@Column({ type: "json" })
players: any[];

@OneToMany(() => GameEntity, gameEntity => gameEntity.game)
entities: GameEntity[];

constructor(private movementStrategy: IMovementStrategy = new BasicMovementStrategy()) {
this.players = [];
}

public addPlayer(player: any): void {
this.players.push(player);
}

public getRepository(): IGameRepository {
return new DoctrineGameRepository();
}

public moveEntities(): void {
this.entities.forEach((entity) => {
this.movementStrategy.move(entity);
});
}
}

export interface IGame extends IGameEntity, IRepositoryBindable<IGameRepository> {}

export interface IGameEntity {
id: number;
players: any[];
entities: GameEntity[];
}

export interface IRepositoryBindable<T> {
getRepository(): T;
}
