interface User {
id: number;
isActive: boolean;
revenue?: number; // Optional property for user's revenue
}

export interface Cohort {
users: User[];
initialRevenue: number;
dayOneRetentionRate?: number;
dailyRetentionRates?: number[];
revenueDailyRetentionRates?: number[];
}
