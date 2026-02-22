```typescript
import { Quest } from "./quest";
import { Time } from "../utils/time";

class QuestScheduler {
private quests: Map<number, Quest>;
private currentTime: Time;

constructor() {
this.quests = new Map();
this.currentTime = new Time();
}

addQuest(quest: Quest): void {
this.quests.set(quest.id, quest);
}

updateTime(time: Time): void {
this.currentTime = time;
for (const quest of this.quests.values()) {
if (quest.isReadyToComplete(this.currentTime)) {
quest.complete();
}
}
}
}
```

This code defines a `QuestScheduler` class that manages a list of `Quest` objects and updates the state of the quests when the time changes. The `Quest` class is assumed to have methods `isReadyToComplete()` and `complete()`. The scheduler also contains a `Time` object to represent the current in-game time.

The `addQuest()` method allows adding new quests to the scheduler, while the `updateTime()` method advances the in-game time and checks if any quests are now ready to be completed. The completed quests are then marked as such using their `complete()` method.
