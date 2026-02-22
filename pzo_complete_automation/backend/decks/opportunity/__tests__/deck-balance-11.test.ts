import { Test, TestingModule } from '@nestjs/testing';
import { DeckBalanceService } from './deck-balance.service';
import { DeckBalanceController } from './deck-balance.controller';
import { DeckService } from 'src/decks/services/deck.service';
import { OpportunityService } from 'src/opportunities/services/opportunity.service';
import { Card, CardInstance } from 'src/common/interfaces/card.interface';
import { Deck } from 'src/decks/entities/deck.entity';
import { Opportunity } from 'src/opportunities/entities/opportunity.entity';
import { CreateDeckDto, UpdateDeckDto } from 'src/decks/dto/create-deck.dto';
import { CreateOpportunityDto } from 'src/opportunities/dto/create-opportunity.dto';

describe('DeckBalanceController', () => {
let deckBalanceService: DeckBalanceService;
let deckBalanceController: DeckBalanceController;
let deckService: DeckService;
let opportunityService: OpportunityService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [DeckBalanceController],
providers: [
DeckBalanceService,
DeckService,
OpportunityService,
{
provide: CardInstance,
useValue: {},
},
],
})
.overrideProvider(Card)
.useValue({})
.overrideProvider(Deck)
.useValue({})
.overrideProvider(Opportunity)
.useValue({});

deckBalanceService = module.get<DeckBalanceService>(DeckBalanceService);
deckBalanceController = module.get<DeckBalanceController>(DeckBalanceController);
deckService = module.get<DeckService>(DeckService);
opportunityService = module.get<OpportunityService>(OpportunityService);
});

describe('deckBalance', () => {
const deckData: CreateDeckDto = {
name: 'Test Deck',
description: 'This is a test deck',
cards: [],
};

const opportunityData: CreateOpportunityDto = {
name: 'Test Opportunity',
description: 'This is a test opportunity',
rewards: {},
};

it('should return the balanced deck and opportunity', async () => {
// Mock services methods here
const mockDeck = {} as Deck;
const mockOpportunity = {} as Opportunity;

jest.spyOn(deckService, 'create').mockResolvedValue(mockDeck);
jest.spyOn(opportunityService, 'create').mockResolvedValue(mockOpportunity);
jest.spyOn(deckBalanceService, 'balanceDeck').mockResolvedValue({});

const result = await deckBalanceController.create(deckData, opportunityData);

expect(result).toEqual({ mockDeck, mockOpportunity });
});
});
});
