import React, { useState } from 'react';
import ageVerification from './age-verification';

const ParentalControlsAgeGating = () => {
const [age, setAge] = useState(0);
const [isVerified, setIsVerified] = useState(false);

const handleBirthdateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
setAge(parseInt(event.target.value));
};

const handleSubmit = async () => {
const isValid = await ageVerification(age);
setIsVerified(isValid);
};

return (
<div>
<h2>Parental Controls + Age Gating</h2>
<form>
<label htmlFor="birthdate">Enter your birthdate:</label>
<input type="number" id="birthdate" name="birthdate" min="1900" max="2016" onChange={handleBirthdateChange} />
<button type="submit" onClick={handleSubmit}>Submit</button>
</form>
{isVerified ? (
<p>Access Granted! Welcome to the site.</p>
) : (
<p>Sorry, you are not old enough to access this content. Please try again later.</p>
)}
</div>
);
};

export default ParentalControlsAgeGating;
