import { fairnessValidation10 } from "../fairness-validation-10";
import { generateGameHistory } from "../../game-generator";
import { Player, GameOutcome } from "@your-project/common";

jest.mock("../../game-generator", () => ({
generateGameHistory: jest.fn(),
}));

describe("fairnessValidation10", () => {
const playerA = new Player("Player A");
const playerB = new Player("Player B");

beforeEach(() => {
(generateGameHistory as jest.Mock).resetAllMocks();
});

it("should return true for a fair game", () => {
// Arrange
(generateGameHistory as jest.Mock).mockReturnValue([
{ winner: playerA, outcome: GameOutcome.Win },
{ winner: playerB, outcome: GameOutcome.Lose },
{ winner: playerA, outcome: GameOutcome.Draw },
]);

// Act
const result = fairnessValidation10(playerA, playerB, 3);

// Assert
expect(result).toBe(true);
});

it("should return false for an unfair game", () => {
// Arrange
(generateGameHistory as jest.Mock).mockReturnValue([
{ winner: playerA, outcome: GameOutcome.Win },
{ winner: playerA, outcome: GameOutcome.Win },
]);

// Act
const result = fairnessValidation10(playerA, playerB, 2);

// Assert
expect(result).toBe(false);
});
});
