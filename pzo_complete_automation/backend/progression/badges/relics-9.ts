import { Relic } from './Relic';

enum RelicProgression {
UNLOCKED = 'unlocked',
COLLECTED = 'collected',
UPGRADED = 'upgraded',
}

interface RelicProgress {
id: string;
progressState: RelicProgression;
}

class Player {
relics: Record<string, Relic>;
progress: Record<string, RelicProgress>;

constructor() {
this.relics = {};
this.progress = {};
}

unlockRelic(relic: Relic) {
const relicId = relic.id;

if (!this.relics[relicId]) {
this.relics[relicId] = relic;
this.progress[relicId] = { id: relicId, progressState: RelicProgression.UNLOCKED };
}
}

collectRelic(relicId: string) {
if (this.progress[relicId].progressState === RelicProgression.UNLOCKED) {
this.progress[relicId].progressState = RelicProgression.COLLECTED;
}
}

upgradeRelic(relicId: string) {
if (this.progress[relicId].progressState === RelicProgression.COLLECTED) {
this.progress[relicId].progressState = RelicProgression.UPGRADED;
// Implement any additional logic for relic upgrade here
}
}
}
