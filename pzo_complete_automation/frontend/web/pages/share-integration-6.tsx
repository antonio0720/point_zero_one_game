import React, { useState } from 'react';
import axios from 'axios';

const ShareIntegration6 = () => {
const [message, setMessage] = useState('');

const shareData = async (url) => {
try {
const response = await axios.post('/api/share', { url });
setMessage(response.data);
} catch (error) {
console.error(error);
}
};

return (
<div>
<input type="text" placeholder="Enter URL to share" onChange={(e) => setMessage(e.target.value)} />
<button onClick={() => shareData(message)}>Share</button>
{message && <p>{message}</p>}
</div>
);
};

export default ShareIntegration6;
