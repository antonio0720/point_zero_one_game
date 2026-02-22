import React, { useState } from 'react';
import styles from './COPPACompliance7.module.css';

interface ParentalConsentFormProps {}

const ParentalConsentForm: React.FC<ParentalConsentFormProps> = () => {
const [parentName, setParentName] = useState('');
const [emailAddress, setEmailAddress] = useState('');
const [dateOfBirth, setDateOfBirth] = useState('');
const [consentGiven, setConsentGiven] = useState(false);

const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
e.preventDefault();
// Send parent data to server
};

return (
<div className={styles.container}>
<h2>Parental Consent Form - COPPA Compliant</h2>
<form onSubmit={handleSubmit}>
<label htmlFor="parentName">Full Name:</label>
<input
id="parentName"
type="text"
value={parentName}
onChange={(e) => setParentName(e.target.value)}
/>
<br />
<label htmlFor="emailAddress">Email Address:</label>
<input
id="emailAddress"
type="email"
value={emailAddress}
onChange={(e) => setEmailAddress(e.target.value)}
/>
<br />
<label htmlFor="dateOfBirth">Date of Birth:</label>
<input
id="dateOfBirth"
type="date"
value={dateOfBirth}
onChange={(e) => setDateOfBirth(e.target.value)}
/>
<br />
<label htmlFor="consent">
I, {parentName}, consent to my child's use of this service. I am over 13 years old.
</label>
<input
id="consent"
type="checkbox"
checked={consentGiven}
onChange={() => setConsentGiven(!consentGiven)}
/>
<br />
<button type="submit">Submit</button>
</form>
</div>
);
};

export default ParentalConsentForm;
