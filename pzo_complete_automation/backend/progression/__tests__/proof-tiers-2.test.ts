import { Achievement, ProofTiers2 } from "../proof-tiers-2";
import { expect } from "chai";

describe("ProofTiers2", () => {
let proofTiers2: ProofTiers2;

beforeEach(() => {
proofTiers2 = new ProofTiers2();
});

it("should return correct tier for a given achievement", () => {
const achievement1 = new Achievement("Achievement1", 10);
const achievement2 = new Achievement("Achievement2", 50);
const achievement3 = new Achievement("Achievement3", 100);

expect(proofTiers2.getTier(achievement1)).to.equal(ProofTiers2.TIER_ONE);
expect(proofTiers2.getTier(achievement2)).to.equal(ProofTiers2.TIER_TWO);
expect(proofTiers2.getTier(achievement3)).to.equal(ProofTiers2.TIER_THREE);
});

it("should return TIER_UNKNOWN for an unknown achievement", () => {
const unknownAchievement = new Achievement("UnknownAchievement", 100);
expect(proofTiers2.getTier(unknownAchievement)).to.equal(ProofTiers2.TIER_UNKNOWN);
});
});
