interface User {
id: string;
firstName: string;
lastName: string;
email: string;
referrals: Array<Referral>;
}

interface Referral {
referredUserId: string;
registrationDate: Date;
status: 'pending' | 'approved' | 'rejected';
}

enum Challenge {
FirstReferral = 10,
FiveReferrals = 50,
TenReferrals = 100,
TwentyFiveReferrals = 200,
}

function calculateTotalPoints(user: User): number {
let totalPoints = 0;

if (user.referrals.length > 0) {
const approvedReferrals = user.referrals.filter((ref) => ref.status === 'approved');
let referralCount = approvedReferrals.length;

totalPoints += Challenge.FirstReferral; // Award points for the first referral

if (referralCount >= 5) {
totalPoints += Challenge.FiveReferrals; // Award points for having 5 or more approved referrals
}

if (referralCount >= 10) {
totalPoints += Challenge.TenReferrals; // Award points for having 10 or more approved referrals
}

if (referralCount >= 25) {
totalPoints += Challenge.TwentyFiveReferrals; // Award points for having 25 or more approved referrals
}
}

return totalPoints;
}
