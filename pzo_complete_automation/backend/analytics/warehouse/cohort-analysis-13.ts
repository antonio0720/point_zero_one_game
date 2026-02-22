import * as _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { DataFrame } from 'datatables';

interface User {
id: string;
signUpDate: Date;
firstPurchaseDate?: Date;
}

const users: User[] = [
// Your user dataset here
];

function groupBySignupCohort(users: User[], daysInCohort: number): DataFrame {
const cohorts = _.chain(users)
.groupBy((user) => new Date(user.signUpDate).setDate(new Date(user.signUpDate).getDate() + (86400 * daysInCohort)))
.mapValues((value) => ({ cohort: value[0].signUpDate, users: value }))
.value();

return new DataFrame(cohorts);
}

function calculateMetrics(cohort: any): { activeUsers: number; totalRevenue: number } {
const currentDay = new Date();
let activeUsers = 0;
let totalRevenue = 0;

cohort.users.forEach((user) => {
if (new Date(user.signUpDate).getTime() <= currentDay.getTime()) {
activeUsers++;
user.firstPurchaseDate && (totalRevenue += calculateRevenue(user.firstPurchaseDate));
}
});

return { activeUsers, totalRevenue };
}

function calculateRevenue(purchaseDate: Date): number {
// Calculate revenue based on the purchase date here (e.g., from a database query or an API call)
return Math.random() * 100;
}

function runCohortAnalysis(users: User[], daysInCohort: number, cohortDataFrame: DataFrame): void {
const cohorts = groupBySignupCohort(users, daysInCohort);
cohorts.columns.push('activeUsers', 'totalRevenue');

cohorts.forEach((cohort) => {
const metrics = calculateMetrics(cohort);
cohorts.addRow({ ...cohort, id: uuidv4(), activeUsers: metrics.activeUsers, totalRevenue: metrics.totalRevenue });
});

console.log(cohorts.toString());
}

// Example usage:
runCohortAnalysis(users, 30, new DataFrame([]));
