import { z } from "zod";
import jwt from "jsonwebtoken";

// User Schema
const userSchema = z.object({
id: z.string().uuid(),
name: z.string(),
email: z.string().email(),
});

// Transaction Schema
const transactionSchema = z.object({
id: z.string().uuid(),
amount: z.number(),
user_id: z.string().uuid(),
created_at: z.date(),
});

// FraudDetector class
class FraudDetector {
private fraudThreshold = 0.5;

detectFraud(transactions: Array<z.infer<typeof transactionSchema>>) {
const userTransactions = transactions.reduce((acc, curr) => {
const userId = curr.user_id;
if (!acc[userId]) acc[userId] = [];
acc[userId].push(curr);
return acc;
}, {} as Record<string, Array<z.infer<typeof transactionSchema>>>);

let fraudulentUsers: string[] = [];
for (const userId in userTransactions) {
const transactionsForUser = userTransactions[userId];
const averageTransactionAmount = transactionsForUser.reduce(
(acc, curr) => acc + curr.amount,
0
) / transactionsForUser.length;

let fraudCount = 0;
let totalAmount = 0;
for (const transaction of transactionsForUser) {
if (transaction.amount > averageTransactionAmount * this.fraudThreshold) {
fraudCount++;
totalAmount += transaction.amount;
}
}

if (fraudCount > 0 && totalAmount / fraudCount >= averageTransactionAmount) {
fraudulentUsers.push(userId);
}
}

return fraudulentUsers;
}
}

// JWT Verifier
const jwtSecret = process.env.JWT_SECRET || "your-secret-key";

function verifyToken(token: string) {
try {
const decoded = jwt.verify(token, jwtSecret);
return userSchema.parse(decoded);
} catch (error) {
console.error("Invalid token", error);
return null;
}
}

// ProofCard class
class ProofCard {
private fraudDetector = new FraudDetector();

async detectFraudForUser(token: string, transactions: Array<z.infer<typeof transactionSchema>>) {
const user = verifyToken(token);
if (!user) throw new Error("Invalid or expired token");

return this.fraudDetector.detectFraud([...transactions, ...user.transactions]);
}
}
