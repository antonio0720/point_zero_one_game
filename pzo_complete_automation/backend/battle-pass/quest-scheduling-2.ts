import { Observable } from 'rxjs';

class BattlePass {
private activeQuests: Map<string, Quest> = new Map();

subscribe(observer: (quest: Quest) => void): () => void {
const unsubscribe = this.activeQuests.forEach((quest, id) => {
observer(quest);
});

return () => {
this.activeQuests.forEach((_, id) => {
this.removeQuest(id);
});
};
}

addQuest(quest: Quest): void {
const id = Math.random().toString();
this.activeQuests.set(id, quest);
this.notifySubscribers(quest);
}

removeQuest(id: string): void {
this.activeQuests.delete(id);
this.notifySubscribers(undefined);
}

private notifySubscribers(quest?: Quest) {
this.activeQuests.forEach((_, id) => {
if (this.activeQuests.get(id) === quest) return;
this.subscribe((observer: any) => observer(quest));
});
}
}

interface Achievement {
name: string;
description: string;
points: number;
completed: boolean;
}

class Quest {
constructor(
public id: string,
public name: string,
public description: string,
public achievement: Achievement | null = null,
public completionConditions: () => Promise<void>
) {}

complete(): Observable<void> {
return new Observable((observer) => {
this.completionConditions()
.then(() => {
if (this.achievement) {
this.achievement.completed = true;
}
battlePass.removeQuest(this.id);
observer();
})
.catch((error) => {
console.error(`Failed to complete quest "${this.name}":`, error);
observer(error);
});
});
}
}

const battlePass = new BattlePass();
