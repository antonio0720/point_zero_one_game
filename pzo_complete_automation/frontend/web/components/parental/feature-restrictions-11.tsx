import * as React from 'react';
import { useLocation } from 'react-router-dom';

interface AgeGateProps {
minAge: number;
}

const AgeGate: React.FC<AgeGateProps> = ({ minAge }) => {
const location = useLocation();
const [age, setAge] = React.useState(0);

const handleBirthdateChange = (event: React.FormEvent<HTMLInputElement>) => {
setAge(parseInt(event.currentTarget.value));
};

const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
event.preventDefault();
if (age >= minAge) {
// Allow access and navigate to the restricted page
location.replace('/restricted');
} else {
// Show an age-gate error message
}
};

return (
<form onSubmit={handleSubmit}>
<label htmlFor="age">What is your birth year?</label>
<input type="number" id="age" value={age} onChange={handleBirthdateChange} />
<button type="submit">Proceed</button>
</form>
);
};

export default AgeGate;
