import { Document, Model, Schema, model } from 'mongoose';

// Abuse report schema
const AbuseReportSchema = new Schema({
userId: String,
abuserId: String,
reportType: String, // abuse/offensiveContent/hateSpeech
description: String,
createdAt: Date,
});

export interface IAbuseReport extends Document {
userId: string;
abuserId: string;
reportType: string;
description: string;
createdAt: Date;
}

const AbuseReport = model<IAbuseReport>('AbuseReport', AbuseReportSchema);

// Ban schema
const BanSchema = new Schema({
userId: String,
banReason: String,
startDate: Date,
endDate: Date,
});

export interface IBan extends Document {
userId: string;
banReason: string;
startDate: Date;
endDate: Date;
}

const Ban = model<IBan>('Ban', BanSchema);

// Helper function to create an abuse report
async function createAbuseReport(userId: string, abuserId: string, reportType: string, description: string) {
const abuseReport = new AbuseReport({ userId, abuserId, reportType, description, createdAt: new Date() });
return await abuseReport.save();
}

// Helper function to ban a user
async function banUser(userId: string, banReason: string) {
const ban = new Ban({ userId, banReason, startDate: new Date(), endDate: null });
return await ban.save();
}

// Helper function to escalate an abuse report if necessary
async function escalateAbuseReport(abuseReportId: string) {
const abuseReport = await AbuseReport.findById(abuseReportId);
if (abuseReport.reportType === 'severeOffense') {
// Example of escalation actions like banning the user or notifying an admin
const bannedUser = await banUser(abuseReport.abuserId, 'Severe offense');
console.log(`Banned ${abuseReport.abuserId} for ${bannedUser.banReason}`);
} else {
console.log(`No further action required for abuse report ${abuseReport._id}`);
}
}
