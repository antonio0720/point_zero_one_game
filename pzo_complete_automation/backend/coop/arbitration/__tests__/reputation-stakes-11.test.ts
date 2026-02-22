import { ReputationStakes11 } from "../reputation-stakes-11";
import { ArbitratorRepository, CooperativeRepository, UserRepository } from "../../repositories";
import { InMemoryArbitratorRepository } from "../../../test/repositories/in-memory-arbitrator.repository";
import { InMemoryCooperativeRepository } from "../../../test/repositories/in-memory-cooperative.repository";
import { InMemoryUserRepository } from "../../../test/repositories/in-memory-user.repository";
import { User, Cooperative, Arbitrator } from "@coop/entities";
import { expect } from "chai";
import sinon from "sinon";

describe("Arbitration - Reputation Stakes 11", () => {
let arbitratorRepository: ArbitratorRepository;
let cooperativeRepository: CooperativeRepository;
let userRepository: UserRepository;

beforeEach(() => {
arbitratorRepository = new InMemoryArbitratorRepository();
cooperativeRepository = new InMemoryCooperativeRepository();
userRepository = new InMemoryUserRepository();
});

it("should calculate reputation stakes correctly", async () => {
const cooperative1 = new Cooperative({ id: "coop1", name: "Coop 1" });
const cooperative2 = new Cooperative({ id: "coop2", name: "Coop 2" });

const arbitrator1 = new Arbitrator({
id: "arb1",
reputation: 7,
cooperatives: [cooperative1.id],
});
const arbitrator2 = new Arbitrator({
id: "arb2",
reputation: 5,
cooperatives: [cooperative2.id],
});

await cooperativeRepository.create(cooperative1);
await cooperativeRepository.create(cooperative2);
await arbitratorRepository.create(arbitrator1);
await arbitratorRepository.create(arbitrator2);

const user1 = new User({ id: "user1", reputation: 3 });
const user2 = new User({ id: "user2", reputation: 4 });

await userRepository.create(user1);
await userRepository.create(user2);

sinon.stub(arbitratorRepository, "findByCooperativeId").resolves([arbitrator1, arbitrator2]);
sinon.stub(userRepository, "findAll").resolves([user1, user2]);

const reputationStakes = await ReputationStakes11({ cooperativeId: cooperative1.id });

expect(reputationStakes).to.deep.equal([{ userId: user1.id, stake: 3 }, { userId: user2.id, stake: 4 }]);

arbitratorRepository.findByCooperativeId.restore();
userRepository.findAll.restore();
});
});
