// src/entity/Game.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from "typeorm";
import { User } from "./User";

@Entity()
export class Game {
@PrimaryGeneratedColumn()
id: number;

@Column({ type: "date" })
date: Date;

@ManyToOne(() => User, (user) => user.games, { onDelete: "CASCADE" })
player: User;
}

// src/repository/GameRepository.ts
import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { Game } from "./entities/Game";

@Injectable()
export class GameRepository extends Repository<Game> {}

// src/services/game.service.ts
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { GameRepository } from "../repository/GameRepository";
import { Game } from "./entities/Game";

@Injectable()
export class GameService {
constructor(@InjectRepository(GameRepository) private readonly gameRepository: GameRepository) {}

async createGame(date: Date, playerId: number): Promise<Game> {
const user = await this.gameRepository.createQueryBuilder("user")
.leftJoinAndSelect("user.games", "game")
.where("user.id = :playerId", { playerId })
.getOne();

if (!user) throw new Error("User not found");

const game = this.gameRepository.create({ date, player: user });
return this.gameRepository.save(game);
}
}

// src/controllers/game.controller.ts
import { Controller, Post, Body, Get, Param } from "@nestjs/common";
import { GameService } from "../services/game.service";
import { Game } from "./entities/Game";

@Controller("games")
export class GameController {
constructor(private readonly gameService: GameService) {}

@Post()
async create(@Body() createGameDto: any): Promise<Game> {
return this.gameService.createGame(createGameDto.date, createGameDto.playerId);
}

@Get(":id")
async findOne(@Param("id") id: number): Promise<Game> {
return this.gameService.findOne(id);
}
}
