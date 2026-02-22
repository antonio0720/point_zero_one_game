import { EconomyEvent } from "../events/economy-event";
import { Asset } from "../assets/asset";
import { Account } from "../accounts/account";
import { Sink, Source } from "./base";
import { TimeService } from "../../time/time.service";
import { LoggerService } from "@nestjs/common";

export class SinkBalancing7 extends Sink {
private _cooldown: number;
private _nextExecutionTime: number;

constructor(private readonly asset: Asset, private readonly account: Account, private readonly timeService: TimeService, private readonly loggerService: LoggerService) {
super();
this._cooldown = 60 * 1000; // 1 minute cooldown
this._nextExecutionTime = this.timeService.now();
}

protected async onReceive(event: EconomyEvent): Promise<void> {
if (this.isCooldownActive()) return;

const source = event.source as Source;
const receivedAmount = event.amount;

this._nextExecutionTime = this.timeService.now() + this._cooldown;
await this.account.deposit(this.asset, receivedAmount);

// Balancing logic based on the sink's requirements
const balance = await this.account.balance(this.asset);
const sourceBalance = await source.balance(this.asset);

if (sourceBalance < balance) {
const amountToTransfer = balance - sourceBalance;
await source.withdraw(this.asset, amountToTransfer);
await this.account.withdraw(this.asset, amountToTransfer);
} else {
this.loggerService.warn(`SinkBalancing7: Transferring more than the available balance from Source (${sourceBalance}) to Sink (${balance}). Skipping transfer.`);
}
}

private isCooldownActive(): boolean {
return this._nextExecutionTime < this.timeService.now();
}
}
