import express from 'express';
import { createConnection } from 'typeorm';

const app = express();
app.use(express.json());

createConnection()
.then(async connection => {
console.log('Database connected');

// Define entities
connection.createQueryBuilder('user', 'u')
.select('u.id, u.name')
.getMany();

app.get('/users', async (req, res) => {
const users = await connection.query(`SELECT id, name FROM user`);
res.json(users);
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server is running on port ${port}`));
})
.catch((error) => console.error(error));
