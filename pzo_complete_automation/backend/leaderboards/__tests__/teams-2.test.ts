import { LeaderboardService } from '../leaderboards';
import { Team } from '../../domain/team';
import { Score } from '../../domain/score';
import { expect } from 'chai';
import sinon from 'sinon';
import { of } from 'rxjs';

describe('Leaderboards - Teams 2', () => {
let leaderboardService: LeaderboardService;
let team1: Team;
let team2: Team;
let score1: Score;
let score2: Score;

beforeEach(() => {
team1 = new Team(1, 'Team One');
team2 = new Team(2, 'Team Two');
score1 = new Score(team1.id!, 50);
score2 = new Score(team2.id!, 75);

leaderboardService = new LeaderboardService();
});

it('should get the top teams', async () => {
const teamScores = [score1, score2];
const mockGetTopTeams = sinon.mock(leaderboardService).expects('getTopTeams').withArgs(2).returns(of(teamScores));

const result = await leaderboardService.getTopTeams(2);

expect(result).to.deep.equal(teamScores);
mockGetTopTeams.verify();
});

it('should add a score for a team', async () => {
const mockAddScore = sinon.mock(leaderboardService).expects('addScore').withArgs(score1.teamId!, score1.points);

await leaderboardService.addScore(score1);

mockAddScore.verify();
});
});
