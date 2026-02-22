import { ClauseType } from "../../clauses";
import { Contract } from "../../contracts";
import { Coop } from "../../entities";
import { expect } from "chai";
import { setupTestDatabase } from "../test-utils/setupTestDatabase";
import { createTestCoop, createTestUser } from "../factories";

describe("Co-op contracts - clauses-8", () => {
let db;
let coop;
let user;
let contract;

before(async () => {
db = await setupTestDatabase();
coop = await createTestCoop({ db });
user = await createTestUser({ db });
contract = new Contract(ClauseType.Clauses8, coop, user);
});

it("should calculate correct remaining amount", async () => {
const initialAmount = 1000;
coop.balance += initialAmount;

// Add a transaction with an amount greater than the clause limit
await db.transaction.create({
type: "income",
value: 2000,
description: "",
user: { id: user.id },
coop: { id: coop.id },
});

// Add a transaction with an amount less than the clause limit
await db.transaction.create({
type: "expense",
value: 800,
description: "",
user: { id: user.id },
coop: { id: coop.id },
});

const remainingAmount = contract.calculateRemaining();

expect(remainingAmount).to.equal(200);
});
});
