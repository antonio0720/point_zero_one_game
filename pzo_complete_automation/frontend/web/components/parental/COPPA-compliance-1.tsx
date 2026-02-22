import React, { useState } from 'react';
import styles from './COPPACompliance1.module.css';

interface ParentalConsentFormProps {}

const ParentalConsentForm: React.FC<ParentalConsentFormProps> = () => {
const [agreed, setAgreed] = useState(false);

const handleAgreementChange = (event: React.ChangeEvent<HTMLInputElement>) => {
setAgreed(event.target.checked);
};

const handleSubmit = (event: React.FormEvent) => {
event.preventDefault();
if (agreed) {
// Proceed with user registration or other actions.
}
};

return (
<div className={styles.parentalConsentForm}>
<h2>Parental Consent Form</h2>
<form onSubmit={handleSubmit}>
<label>
I, the parent or legal guardian of the child, give my consent for my child to use this service.
<input
type="checkbox"
checked={agreed}
onChange={handleAgreementChange}
required
/>
</label>
<button type="submit">Submit</button>
</form>
</div>
);
};

export default ParentalConsentForm;
