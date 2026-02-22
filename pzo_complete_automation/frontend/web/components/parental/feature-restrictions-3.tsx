import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAgeCheckContext } from '../../context/AgeCheckContext';

const FeatureRestrictions3 = () => {
const location = useLocation();
const { isUnderage, setIsUnderage } = useAgeCheckContext();

const handleAgeVerification = (age: number) => {
if (age >= 18) {
setIsUnderage(false);
} else {
setIsUnderage(true);
}
};

if (isUnderage && location.pathname !== '/age-verification') {
return (
<div>
<h1>Access Denied</h1>
<p>
You must be 18 years or older to access this content. Please verify your age by navigating to the age verification page.
</p>
<button onClick={() => window.location.href = '/age-verification'}>Go to Age Verification</button>
</div>
);
}

return null;
};

export default FeatureRestrictions3;
