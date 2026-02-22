import React from 'react';
import { useLocation } from 'react-router-dom';
import { AgeGateContext, setAge } from './age-gate-context';

const FeatureRestrictions9 = () => {
const location = useLocation();
const [, , age] = location.pathname.split('/') || ['', '', ''];

const handleAgeChange = (newAge: number) => {
setAge(newAge);
};

if (+age < 18) {
return (
<div>
You are under 18. Please provide your age to access this feature.
< AgeInput onAgeChange={handleAgeChange} />
</div>
);
}

return <div>Welcome to Feature Restrictions 9</div>;
};

const AgeInput = ({ onAgeChange }) => {
const [age, setAge] = React.useState(18);

const handleAgeChange = (event: any) => {
setAge(event.target.value);
onAgeChange(event.target.value);
};

return <input type="number" value={age} onChange={handleAgeChange} />;
};

FeatureRestrictions9.contextType = AgeGateContext;

export default FeatureRestrictions9;
