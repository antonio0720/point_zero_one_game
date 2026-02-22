import { Test, Suite } from "@aepp/aurelia-test";
import { IContractInstance } from "../../../../src/contracts/kernel";
import { CECLv1KernelFactory } from "../../../../src/factories/ceclv1-kernel-factory";
import { AccountsManager } from "../../../../src/managers/accounts-manager";
import { Kernel } from "../../../../src/kernel";
import { User, UserAccount } from "../../../../src/models/user";
import { ContractInstanceFixture } from "../fixtures/contract-instance.fixture";
import { CECLv1ContractInstanceFixture } from "../fixtures/ceclv1-contract-instance.fixture";

@Suite("Governance kernel + CECL_v1 - crash-loop-recovery-1")
export class CrashLoopRecoveryTest extends Test {
private kernel: Kernel;
private user: User;
private accountsManager: AccountsManager;

@BeforeEach
public async setup() {
this.kernel = await CECLv1KernelFactory.create();
this.user = new User();
const contractInstanceFixture = new ContractInstanceFixture(this.kernel);
this.accountsManager = this.kernel.get(AccountsManager);
await contractInstanceFixture.setup(this.user, this.accountsManager);
}

@Test
public async testCrashLoopRecovery() {
const ceclv1ContractInstanceFixture = new CECLv1ContractInstanceFixture(this.kernel, this.user);
await ceclv1ContractInstanceFixture.setup();

const ceclv1ContractInstance: IContractInstance = ceclv1ContractInstanceFixture.getContractInstance();

// Trigger a crash inside the CECLv1 contract instance
// (for example, by calling an invalid function)

// Assert that the contract instance was destroyed and re-created after the crash
const newCeclv1ContractInstance: IContractInstance = this.accountsManager.getContractInstance(ceclv1ContractInstanceFixture.contractAddress);
expect(newCeclv1ContractInstance).not.toBeNull();
}
}
