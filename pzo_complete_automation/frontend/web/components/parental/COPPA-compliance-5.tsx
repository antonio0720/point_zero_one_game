import React, { useState } from 'react';
import classnames from 'classnames';

const COPPAAgreement = ({ className }) => {
const [agreed, setAgreed] = useState(false);

const handleAgreementChange = (event) => {
setAgreed(event.target.checked);
};

return (
<div className={classnames('coppa-agreement', className)}>
<label>
I have obtained verifiable parental consent for my child to use this service.
<input
type="checkbox"
checked={agreed}
onChange={handleAgreementChange}
/>
</label>
</div>
);
};

export default COPPAAgreement;
