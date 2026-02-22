import { expect } from 'chai';
import sinon from 'sinon';
import { stubInterface, SinonStubbedInstance } from 'sinon';
import { RivalryLedger3 } from '../../../src/backend/ml/companions/batch1/RivalryLedger3';
import { IMatchDataProvider } from '../../../src/shared/interfaces/IMatchDataProvider';
import { Match } from '../../../src/shared/models/Match';

describe('RivalryLedger3', () => {
let rivalryLedger3: RivalryLedger3;
let matchDataProviderStub: SinonStubbedInstance<IMatchDataProvider>;

beforeEach(() => {
matchDataProviderStub = stubInterface(IMatchDataProvider);
rivalryLedger3 = new RivalryLedger3(matchDataProviderStub);
});

describe('#getMatches', () => {
it('should return matches for a specific game', async () => {
const gameId = 'game-123';
const matches = [new Match('team-1', 'team-2')];

matchDataProviderStub.getMatchesForGame.withArgs(gameId).returns(Promise.resolve(matches));

const result = await rivalryLedger3.getMatches(gameId);
expect(result).to.deep.equal(matches);
});
});

describe('#generateRivalryScore', () => {
it('should generate a correct rivalry score based on the matches', () => {
const gameId = 'game-123';
const matches = [new Match('team-1', 5, 'team-2', 4)];

matchDataProviderStub.getMatchesForGame.withArgs(gameId).returns(Promise.resolve(matches));

sinon.spy(rivalryLedger3, 'calculateRivalryScore');
rivalryLedger3.generateRivalryScore(gameId);
expect(rivalryLedger3.calculateRivalryScore).to.have.been.calledOnce;
});
});

describe('#calculateRivalryScore', () => {
it('should calculate the rivalry score correctly based on match results', () => {
const gameId = 'game-123';
const matches = [new Match('team-1', 5, 'team-2', 4)];
const expectedRivalryScore = { team1: 10, team2: 9 };

const result = rivalryLedger3.calculateRivalryScore(matches);
expect(result).to.deep.equal(expectedRivalryScore);
});
});
});
