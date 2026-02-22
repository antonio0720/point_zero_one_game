import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

interface User {
id: number;
age: number;
consentFormsSigned: boolean[];
}

let users: User[] = [];

// Add a user
app.post('/users', (req, res) => {
const { name, age } = req.body;
const newUser: User = { id: users.length + 1, age, consentFormsSigned: [] };
users.push(newUser);
res.status(201).json(newUser);
});

// Sign a consent form
app.put('/users/:id/consent/:form', (req, res) => {
const { id } = req.params;
const formIndex = parseInt(req.params.form);
const user = users.find((user) => user.id === parseInt(id));

if (!user) {
return res.status(404).json({ message: 'User not found' });
}

if (formIndex < 0 || formIndex >= user.consentFormsSigned.length) {
return res.status(400).json({ message: 'Invalid consent form index' });
}

user.consentFormsSigned[formIndex] = true;
res.status(200).json(user);
});

// Check if a user has signed the required consent forms
app.get('/users/:id/consent', (req, res) => {
const { id } = req.params;
const user = users.find((user) => user.id === parseInt(id));

if (!user) {
return res.status(404).json({ message: 'User not found' });
}

const requiredConsentForms = [0, 1, 2]; // Example of required consent forms
let missingConsentForms = [];

requiredConsentForms.forEach((form) => {
if (!user.consentFormsSigned[form]) {
missingConsentForms.push(form);
}
});

res.status(200).json({ consentFormsMissing: missingConsentForms });
});

app.listen(3000, () => console.log('Server started on port 3000'));
