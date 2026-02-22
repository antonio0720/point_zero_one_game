import express from 'express';
import { Pool } from 'pg';

const app = express();
const pool = new Pool({
user: 'your_db_user',
host: 'your_db_host',
database: 'your_db_name',
password: 'your_db_password',
port: your_db_port,
});

app.use(express.json());

interface Dispute {
id: number;
customerId: number;
disputeDescription: string;
proofSubmitted: boolean;
decision: string;
}

app.post('/disputes', async (req, res) => {
const disputeData: Dispute = req.body;

try {
await pool.query('INSERT INTO disputes VALUES ($1, $2, $3, $4)', [
disputeData.id,
disputeData.customerId,
disputeData.disputeDescription,
disputeData.proofSubmitted,
]);

const dispute = await pool.query('SELECT * FROM disputes WHERE id = $1', [
disputeData.id,
])
.then((result) => result.rows[0])
.catch((err) => {
console.error(err);
return null;
});

if (dispute && dispute.proofSubmitted) {
const decision = await makeDecisionBasedOnProof(dispute);
await pool.query('UPDATE disputes SET decision = $1 WHERE id = $2', [
decision,
disputeData.id,
]);
}

res.status(200).send();
} catch (err) {
console.error(err);
res.status(500).send();
}
});

// Implement makeDecisionBasedOnProof function according to your logic
function makeDecisionBasedOnProof(dispute: Dispute): string {
// Your implementation goes here...
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
