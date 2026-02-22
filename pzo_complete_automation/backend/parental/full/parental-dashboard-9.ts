import React, { useState } from 'react';
import axios from 'axios';

interface User {
id: number;
email: string;
age: number;
}

const ParentalDashboard: React.FC = () => {
const [user, setUser] = useState<User>({ id: -1, email: '', age: -1 });

const handleAgeVerification = async () => {
if (user.age < 18) {
alert('You must be at least 18 years old to access this content.');
return;
}

try {
const response = await axios.post('/api/check-access', user);
if (response.data.accessGranted) {
// Access granted, show parental controls or other content
} else {
alert('Access denied.');
}
} catch (error) {
console.error(error);
alert('An error occurred while checking access.');
}
};

return (
<div>
{user.email ? (
<>
<h1>Welcome, {user.email}!</h1>
<button onClick={handleAgeVerification}>Verify Age and Access Content</button>
</>
) : (
<>
<h1>Please sign in or create an account.</h1>
{/* Sign-in / sign-up form */}
</>
)}
</div>
);
};

export default ParentalDashboard;
