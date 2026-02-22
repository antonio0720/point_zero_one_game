import express from 'express';
import mailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const recoveryEmailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Password Recovery</title>
</head>
<body>
<h1>Password Recovery</h1>
<p>To reset your password, please visit the following link:</p>
<a href="${process.env.APP_URL}/reset-password/${token}">Reset Password</a>
</body>
</html>
`;

app.use(express.json());

const transporter = mailer.createTransport({
host: process.env.SMTP_HOST,
port: Number(process.env.SMTP_PORT),
secure: true, // secure connection using SSL, TLS or STARTTLS
auth: {
user: process.env.SMTP_USERNAME,
pass: process.env.SMTP_PASSWORD,
},
});

app.post('/recover', (req, res) => {
const email = req.body.email;
if (!email) return res.status(400).send('Email is required.');

// Generate a recovery token and store it in the database with the user's email
const token = uuidv4();

const mailOptions = {
from: process.env.SMTP_USERNAME,
to: email,
subject: 'Password Recovery',
text: 'Please visit this link to reset your password.',
html: recoveryEmailTemplate.replace('${token}', token),
};

transporter.sendMail(mailOptions, (error, info) => {
if (error) return res.status(500).send(error);
res.send(`Recovery email sent to ${email}`);
});
});

app.listen(port, () => console.log(`Listening on port ${port}`));
