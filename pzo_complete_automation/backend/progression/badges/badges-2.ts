interface IBadge {
id: string;
name: string;
description: string;
}

abstract class Badge implements IBadge {
constructor(public id: string, public name: string, public description: string) {}

abstract earn(): void;
}

class ExperienceBadge extends Badge {
level: number;

constructor(id: string, name: string, description: string, level: number) {
super(id, name, description);
this.level = level;
}

earn(): void {
console.log(`Congratulations! You earned the ${this.name} badge!`);
}
}

class CompletionBadge extends Badge {
taskCount: number;

constructor(id: string, name: string, description: string, taskCount: number) {
super(id, name, description);
this.taskCount = taskCount;
}

earn(): void {
console.log(`Congratulations! You earned the ${this.name} badge for completing all tasks.`);
}
}
