import { Test, TestingModule } from '@nestjs/testing';
import { DeckService } from '../deck.service';
import { DeckController } from '../deck.controller';
import { Deck, Card, Player } from '../../entities';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeckRepository } from '../decks.repository';
import { CreateDeckDto } from '../dto/create-deck.dto';
import { UpdateDeckDto } from '../dto/update-deck.dto';

describe('DeckController', () => {
let deckService: DeckService;
let deckController: DeckController;
let deckRepository: Repository<Deck>;
let cardRepository: Repository<Card>;
let playerRepository: Repository<Player>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [DeckController],
providers: [
DeckService,
{ provide: DeckRepository, useValue: {} },
{ provide: getRepositoryToken(Card), useValue: {} },
{ provide: getRepositoryToken(Player), useValue: {} },
],
}).compile();

deckService = module.get<DeckService>(DeckService);
deckController = module.get<DeckController>(DeckController);
deckRepository = module.get<Repository<Deck>>(DeckRepository);
cardRepository = module.get<Repository<Card>>(getRepositoryToken(Card));
playerRepository = module.get<Repository<Player>>(getRepositoryToken(Player));
});

describe('create', () => {
it('should create a new deck', async () => {
const createDeckDto: CreateDeckDto = {};
const createdDeck = await deckController.create(createDeckDto);
expect(createdDeck).toBeDefined();
});
});

describe('findAll', () => {
it('should return all decks', async () => {
const decks = []; // fill with test data
deckRepository.find = jest.fn(() => Promise.resolve(decks));
const result = await deckController.findAll();
expect(result).toEqual(decks);
});
});

describe('findOne', () => {
it('should return a single deck', async () => {
const id = 1;
const deck = {} as Deck;
deckRepository.findOneBy = jest.fn(() => Promise.resolve(deck));
const result = await deckController.findOne(id);
expect(result).toEqual(deck);
});
});

describe('update', () => {
it('should update a deck', async () => {
const id = 1;
const updateDeckDto: UpdateDeckDto = {};
const updatedDeck = {} as Deck;
deckRepository.findOneBy = jest.fn(() => Promise.resolve(updatedDeck));
deckRepository.save = jest.fn(() => Promise.resolve(updatedDeck));
const result = await deckController.update(id, updateDeckDto);
expect(result).toEqual(updatedDeck);
});
});

describe('remove', () => {
it('should delete a deck', async () => {
const id = 1;
deckRepository.delete = jest.fn(() => Promise.resolve());
await deckController.remove(id);
expect(deckRepository.delete).toHaveBeenCalledWith(id);
});
});
});
