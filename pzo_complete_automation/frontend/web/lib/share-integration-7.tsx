import * as React from 'react';
import { useEffect } from 'react';
import { Facebook, LinkedIn, Twitter } from '@material-ui/icons';
import { Button, Typography } from '@material-ui/core';
import axios from 'axios';

interface Props {
url: string;
}

const ShareIntegration7: React.FC<Props> = ({ url }) => {
useEffect(() => {
const shareScriptUrl = 'https://connect.facebook.net/en_US/sdk.js';
const script = document.createElement('script');
script.src = shareScriptUrl;
script.async = true;
document.body.appendChild(script);
}, []);

const handleShareToFacebook = () => {
FB.ui(
{
method: 'share',
href: url,
},
(response) => {
if (response && !response.error_message) {
console.log('Post ID:', response['post_id']);
}
}
);
};

const handleShareToTwitter = () => {
axios.get(`https://twitter.com/share?url=${encodeURIComponent(url)}`);
};

const handleShareToLinkedIn = () => {
window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
};

return (
<div>
<Typography variant='h6'>Share This Page:</Typography>
<Button onClick={handleShareToFacebook}>
<Facebook fontSize='large' /> Facebook
</Button>
<Button onClick={handleShareToTwitter}>
<Twitter fontSize='large' /> Twitter
</Button>
<Button onClick={handleShareToLinkedIn}>
<LinkedIn fontSize='large' /> LinkedIn
</Button>
</div>
);
};

export default ShareIntegration7;
