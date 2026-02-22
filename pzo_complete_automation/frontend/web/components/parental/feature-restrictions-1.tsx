import React, { useState } from 'react';
import { useDispatch } from 'react-redux';

const FeatureRestrictions1 = () => {
const dispatch = useDispatch();
const [age, setAge] = useState(null);

const handleSubmit = (event) => {
event.preventDefault();
if (!age || age < 18) {
// Redirect to age-gating page or display age-gating message
window.location.href = '/age-gate';
} else {
dispatch({ type: 'UNLOCK_FEATURES' });
}
};

return (
<form onSubmit={handleSubmit}>
<label htmlFor="age">Please enter your age:</label>
<input id="age" type="number" value={age} onChange={(e) => setAge(parseInt(e.target.value))} />
<button type="submit">Submit</button>
</form>
);
};

export default FeatureRestrictions1;
