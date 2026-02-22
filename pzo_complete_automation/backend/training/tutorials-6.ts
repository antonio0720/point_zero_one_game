import express from 'express';
import mongoose from 'mongoose';

// Connect to MongoDB
const dbURI = 'mongodb://localhost/your_database_name';
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
console.log('Connected to database');
});

// Define a schema for the users collection
const userSchema = new mongoose.Schema({
name: String,
email: String,
});

// Create a model (collection) based on the schema
const User = mongoose.model('User', userSchema);

// Import Express and create an instance of it
import bodyParser from 'body-parser';
const app = express();
app.use(bodyParser.json());

// Define routes for creating, reading, updating, and deleting users
app.post('/users', async (req, res) => {
const user = new User(req.body);
await user.save();
res.send(user);
});

app.get('/users', async (req, res) => {
const users = await User.find({});
res.send(users);
});

app.put('/users/:id', async (req, res) => {
const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
res.send(user);
});

app.delete('/users/:id', async (req, res) => {
await User.findByIdAndRemove(req.params.id);
res.sendStatus(204);
});

// Start the server on a specific port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`Server started on port ${PORT}`);
});
