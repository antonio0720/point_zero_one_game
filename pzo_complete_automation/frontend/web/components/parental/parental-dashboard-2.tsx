import React, { useState } from 'react';
import axios from 'axios';

interface User {
id: number;
username: string;
password: string;
email: string;
age: number;
}

interface AgeGatingProps {
onAgeVerified: (user: User) => void;
}

const AgeGating: React.FC<AgeGatingProps> = ({ onAgeVerified }) => {
const [age, setAge] = useState(0);
const [error, setError] = useState('');

const handleVerifyAge = () => {
if (age < 18) {
setError('You must be at least 18 years old to access this content.');
return;
}

axios
.post('/api/users', { username: 'exampleUsername', password: 'examplePassword', email: 'exampleEmail@example.com', age })
.then((response) => {
onAgeVerified(response.data);
})
.catch((error) => {
setError('An error occurred while verifying your account.');
});
};

return (
<div>
<h2>Age Gating</h2>
<p>{error}</p>
<label htmlFor="age">Enter your age:</label>
<input type="number" id="age" value={age} onChange={(e) => setAge(parseInt(e.target.value, 10))} />
<button onClick={handleVerifyAge}>Verify Age</button>
</div>
);
};

interface ParentalDashboard2Props {}

const ParentalDashboard2: React.FC<ParentalDashboard2Props> = () => {
const [user, setUser] = useState<User | null>(null);

return (
<div>
{!user ? (
<AgeGating onAgeVerified={setUser} />
) : (
<div>
<h1>Welcome, {user.username}!</h1>
{/* Add more parental dashboard features here */}
</div>
)}
</div>
);
};

export default ParentalDashboard2;
