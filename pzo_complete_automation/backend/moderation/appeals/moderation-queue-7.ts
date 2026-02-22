import { Ban, User } from './user';
import { QueueItem } from './queue';

export class ModerationQueue {
private queue: QueueItem[] = [];

addToQueue(user: User, reason: string): void {
const appeal = new QueueItem(user, reason);
this.queue.push(appeal);
}

processQueue(): void {
if (this.queue.length === 0) return;

const currentAppeal = this.queue[0];
this.queue.shift();

// Perform moderation action based on the appeal and user data
const isAbuse = currentAppeal.reason.includes('abuse');
if (isAbuse) {
currentAppeal.user.ban(7); // Ban the user for 7 days
console.log(`User ${currentAppeal.user.username} has been banned for abuse.`);
} else {
console.log(`The appeal by user ${currentAppeal.user.username} has been reviewed and no action taken.`);
}
}
}

class User {
constructor(public username: string, private banDuration?: number) {}

ban(duration: number): void {
this.banDuration = duration;
console.log(`User ${this.username} has been banned for ${duration} days.`);
}
}

class Ban {
constructor(private user: User, private duration: number) {}

get isBanned(): boolean {
return this.user.banDuration !== undefined;
}
}

class QueueItem {
constructor(public user: User, public reason: string) {}
}
