import { v4 as uuidv4 } from 'uuid';

interface User {
id: string;
name: string;
email: string;
referrals: number;
isActive: boolean;
}

interface Referral {
senderId: string;
recipientId: string;
loopIndex: number;
}

class UserRepository {
private users: User[] = [];

addUser(name: string, email: string): void {
const user: User = {
id: uuidv4(),
name,
email,
referrals: 0,
isActive: true,
};
this.users.push(user);
}

getUserById(id: string): User | undefined {
return this.users.find((user) => user.id === id);
}
}

class ReferralRepository {
private referrals: Referral[] = [];

addReferral(senderId: string, recipientId: string, loopIndex: number): void {
const referral: Referral = { senderId, recipientId, loopIndex };
this.referrals.push(referral);
}

getReferralByRecipientId(recipientId: string): Referral[] {
return this.referrals.filter((referral) => referral.recipientId === recipientId);
}
}

class ShareLoops {
private userRepository = new UserRepository();
private referralRepository = new ReferralRepository();

shareLoop1(sender: string, recipients: string[]): void {
recipients.forEach((recipient) => {
const user = this.userRepository.getUserById(recipient);
if (user) {
const referral = { senderId: sender, recipientId: recipient, loopIndex: 1 };
this.referralRepository.addReferral(sender, recipient, 1);
user.referrals++;
}
});
}

shareLoop2(sender: string): void {
const user = this.userRepository.getUserById(sender);
if (user) {
const referrals = this.referralRepository.getReferralByRecipientId(sender);
if (referrals.length > 0) {
const recipients: string[] = [];
for (const referral of referrals) {
const recipientUser = this.userRepository.getUserById(referral.recipientId);
if (recipientUser && recipientUser.isActive) {
recipients.push(referral.recipientId);
}
}
this.shareLoop1(sender, recipients);
}
}
}

shareLoop3(sender: string): void {
const user = this.userRepository.getUserById(sender);
if (user) {
const referrals = this.referralRepository.getReferralByRecipientId(sender);
if (referrals.length > 0) {
let recipients: string[] = [];
for (const referral of referrals) {
const recipientUser = this.userRepository.getUserById(referral.recipientId);
if (recipientUser && recipientUser.isActive) {
const innerReferrals = this.referralRepository.getReferralByRecipientId(referral.recipientId);
if (innerReferrals.length > 0) {
recipients.push(referral.recipientId);
}
}
}
this.shareLoop2(sender);
this.shareLoop1(sender, recipients);
}
}
}

shareLoop4(sender: string): void {
const user = this.userRepository.getUserById(sender);
if (user) {
const referrals = this.referralRepository.getReferralByRecipientId(sender);
if (referrals.length > 0) {
let recipients: string[] = [];
for (const referral of referrals) {
const recipientUser = this.userRepository.getUserById(referral.recipientId);
if (recipientUser && recipientUser.isActive) {
const innerReferrals = this.referralRepository.getReferralByRecipientId(referral.recipientId);
if (innerReferrals.length > 0) {
let secondLevelRecipients: string[] = [];
for (const innerReferral of innerReferrals) {
const secondLevelUser = this.userRepository.getUserById(innerReferral.recipientId);
if (secondLevelUser && secondLevelUser.isActive) {
secondLevelRecipients.push(innerReferral.recipientId);
}
}
recipients = [...recipients, ...secondLevelRecipients];
}
}
}
this.shareLoop3(sender);
this.shareLoop2(sender);
this.shareLoop1(sender, recipients);
}
}
}
}

// Example usage:
const shareLoops = new ShareLoops();
shareLoops.userRepository.addUser('John', 'john@example.com');
shareLoops.userRepository.addUser('Alice', 'alice@example.com');

// ... More users added...

shareLoops.shareLoop4('John');
