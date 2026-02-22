import React from 'react';
import { useHistory } from 'react-router-dom';
import { ShareIntegration18Data } from './data/ShareIntegration18Data';

const ShareIntegration18 = () => {
const history = useHistory();

const handleClick = () => {
navigator.share({
title: 'Share Integration 18',
url: window.location.href,
text: 'Check out this awesome Share Integration 18!',
})
.then(() => {
console.log('Successfully shared Share Integration 18');
history.push('/'); // Redirect to home page after successful share
})
.catch((error) => {
console.error('Error sharing Share Integration 18:', error);
});
};

return (
<div>
<h1>Share Integration 18</h1>
<button onClick={handleClick}>Share</button>
{ShareIntegration18Data.map((data, index) => (
<div key={index}>
<h2>{data.header}</h2>
<p>{data.description}</p>
</div>
))}
</div>
);
};

export default ShareIntegration18;
