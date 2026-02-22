import { Pool } from 'pg-promise';

const pgp = new Pool({
host: process.env.DB_HOST,
port: Number(process.env.DB_PORT),
user: process.env.DB_USER,
password: process.env.DB_PASSWORD,
database: process.env.DB_NAME,
});

interface User {
id: number;
signupDate: Date;
}

interface CohortAnalysisResponse {
cohort: string;
activeUsersCount: number;
newRegisteredUsersCount: number;
}

async function getCohorts(): Promise<string[]> {
const result = await pgp.query('SELECT DISTINCT EXTRACT(YEAR FROM signup_date) AS cohort FROM users ORDER BY signup_date ASC');
return result[0] as unknown as Cohort[];
}

async function getCohortAnalysis(cohort: string): Promise<CohortAnalysisResponse> {
const result = await pgp.any(`
SELECT COUNT(*) AS activeUsersCount, COUNT(DISTINCT id) AS newRegisteredUsersCount
FROM users
WHERE EXTRACT(YEAR FROM signup_date) = $1 AND signup_date <= CURRENT_DATE
`, [cohort]);

return result[0] as unknown as CohortAnalysisResponse;
}

async function run() {
const cohorts = await getCohorts();

for (const cohort of cohorts) {
console.log(`Coohort: ${cohort}`);
const analysisResult = await getCohortAnalysis(cohort);
console.log(`Active users count: ${analysisResult.activeUsersCount}`);
console.log(`New registered users count: ${analysisResult.newRegisteredUsersCount}`);
}
}

run().catch((err) => {
console.error(err);
});
