import { Test, TestingModule } from '@nestjs/testing';
import { DeckReactorService } from '../deck-reactor.service';
import { DeckBalancerService } from '../../ml/services/deck-balancer.service';
import { DeckModel } from '../../ml/interfaces/deck.model';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { deckSchema } from '../../ml/schemas/deck.schema';
import { of } from 'rxjs';

describe('DeckReactorService - ML-driven-balancing-6', () => {
let service: DeckReactorService;
let deckBalancerService: DeckBalancerService;
let DeckModel: Model<DeckModel>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
DeckReactorService,
DeckBalancerService,
{ provide: getModelToken('Deck'), useValue: DeckModel },
],
}).compile();

service = module.get<DeckReactorService>(DeckReactorService);
deckBalancerService = module.get<DeckBalancerService>(DeckBalancerService);
DeckModel = module.get<Model<DeckModel>>(getModelToken('Deck'));
});

describe('balancingCards', () => {
const testCases: Array<{ name: string; inputDeck: DeckModel; expectedOutput: DeckModel }> = [
// Add test cases here with appropriate input and output decks
];

testCases.forEach(({ name, inputDeck, expectedOutput }) => {
it(name, async () => {
jest.spyOn(deckBalancerService, 'balanceCards').mockReturnValue(of(expectedOutput));
const result = await service.balancingCards(inputDeck);
expect(result).toEqual(expectedOutput);
});
});
});
});
