import { MacroSystem, MacroVariable } from 'macro-system';
import { Injectable } from '@nestjs/common';
import { CreditAvailabilityService } from './credit-availability.service';
import { BusinessCycleIndexService } from '../business-cycle/business-cycle-index.service';

@Injectable()
export class CreditTightnessMacroSystemV1 extends MacroSystem {
private businessCycleIndex: number;

constructor(
private readonly creditAvailabilityService: CreditAvailabilityService,
private readonly businessCycleIndexService: BusinessCycleIndexService,
) {
super('credit-tightness-1');
}

async onInitialize() {
this.businessCycleIndex = await this.businessCycleIndexService.getCurrentIndex();
}

get creditTightness(): MacroVariable<number> {
return new MacroVariable(
'credit-tightness',
this.calculateCreditTightness(),
);
}

private calculateCreditTightness(): number {
const baseValue = 0.5; // Default credit availability when the business cycle index is neutral (0)
const expansionMultiplier = 1.2; // Increase credit availability during economic expansion
const contractionMultiplier = 0.8; // Decrease credit availability during economic contraction

const multiplier = this.businessCycleIndex > 0 ? expansionMultiplier : contractionMultiplier;

return baseValue * multiplier;
}
}
