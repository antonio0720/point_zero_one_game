import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

const port = process.env.PORT || 3000;

// Replace DATE_OF_BIRTH_FORMAT with the desired date of birth format (e.g., "MM-DD-YYYY")
const DATE_OF_BIRTH_FORMAT = "MM-DD-YYYY";
const MINIMUM_AGE = 13; // Minimum age required to access the service (in years)

app.post('/age-gate', (req, res) => {
const dateOfBirth = req.body.dateOfBirth;

if (!dateOfBirth || !isValidDate(dateOfBirth, DATE_OF_BIRTH_FORMAT)) {
return res.status(400).json({ error: 'Invalid date of birth format' });
}

const age = calculateAge(dateOfBirth);

if (age < MINIMUM_AGE) {
return res.status(403).json({ error: `User is not old enough to access the service. Minimum age required: ${MINIMUM_AGE}` });
}

res.status(200).json({ success: true });
});

function isValidDate(dateString: string, format: string): boolean {
const regex = new RegExp(`^(${format})(\\d{4})$`);
return regex.test(dateString);
}

function calculateAge(birthDate: string): number {
const today = new Date();
const birthDateObj = new Date(birthDate);
let age = today.getFullYear() - birthDateObj.getFullYear();

// Adjust for months, days and leap years
const m = today.getMonth() - birthDateObj.getMonth();
if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
age--;
}

return age;
}

app.listen(port, () => console.log(`Server is running on port ${port}`));
