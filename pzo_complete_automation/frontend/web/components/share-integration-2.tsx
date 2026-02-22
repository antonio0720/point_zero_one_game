import React, { useState } from 'react';
import { FacebookShareButton, TwitterShareButton, WhatsappShareButton } from 'react-share';
import { FacebookIcon, TwitterIcon, WhatsappIcon } from 'react-share';

const ShareIntegration2 = () => {
const [url, setUrl] = useState('https://yourwebsite.com');

return (
<div>
<input type="text" value={url} onChange={e => setUrl(e.target.value)} />
<FacebookShareButton url={url}>
<FacebookIcon size={40} round={true}/>
</FacebookShareButton>
<TwitterShareButton url={url}>
<TwitterIcon size={40} round={true}/>
</TwitterShareButton>
<WhatsappShareButton url={url}>
<WhatsappIcon size={40} round={true}/>
</WhatsappShareButton>
</div>
);
};

export default ShareIntegration2;
