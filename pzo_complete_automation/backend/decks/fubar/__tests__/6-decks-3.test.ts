import { Test, TestingModule } from '@nestjs/testing';
import { DeckService } from '../deck.service';
import { DeckController } from '../deck.controller';
import { Deck } from '../../entities/deck.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('Deck Controller (e2e)', () => {
let deckService: DeckService;
let deckController: DeckController;
let deckRepository: Repository<Deck>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [DeckController],
providers: [DeckService, DeckService],
})
.overrideProvider(getRepositoryToken(Deck))
.useValue({})
.compile();

deckService = module.get<DeckService>(DeckService);
deckController = module.get<DeckController>(DeckController);
deckRepository = module.get<Repository<Deck>>(getRepositoryToken(Deck));
});

describe('list', () => {
it('should return an array of decks', async () => {
// Your test code for the 'list' method goes here.
});
});

describe('create', () => {
const createDeckDto = new Deck();

it('should create a deck and return created deck', async () => {
// Your test code for the 'create' method goes here.
});
});

describe('findOne', () => {
const findOneDeckDto: Deck = new Deck();

it('should return the requested deck', async () => {
// Your test code for the 'findOne' method goes here.
});
});

describe('update', () => {
const updateDeckDto: Deck = new Deck();

it('should update an existing deck and return updated deck', async () => {
// Your test code for the 'update' method goes here.
});
});

describe('remove', () => {
const removeDeckDto: Deck = new Deck();

it('should delete an existing deck and return deleted deck', async () => {
// Your test code for the 'remove' method goes here.
});
});
});
