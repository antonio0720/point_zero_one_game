import React from 'react';
import { useState } from 'react';
import shareIcon from './share-icon.png';
import twitterLogo from './twitter-logo.svg';
import facebookLogo from './facebook-logo.svg';
import linkedinLogo from './linkedin-logo.svg';

const ShareIntegration8: React.FC<{}> = () => {
const [url, setUrl] = useState('');

const handleCopy = () => {
navigator.clipboard.writeText(url);
};

return (
<div className="share-integration">
<h2>Share this page</h2>
<input
type="text"
value={url}
onChange={e => setUrl(e.target.value)}
placeholder="Enter URL here..."
/>
<button onClick={handleCopy}>Copy link</button>
<div className="social-media">
<a
href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(
url
)}`}
target="_blank"
rel="noreferrer"
>
<img src={twitterLogo} alt="Twitter" />
</a>
<a
href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
url
)}`}
target="_blank"
rel="noreferrer"
>
<img src={facebookLogo} alt="Facebook" />
</a>
<a
href={`https://www.linkedin.com/shareArticle?url=${encodeURIComponent(
url
)}`}
target="_blank"
rel="noreferrer"
>
<img src={linkedinLogo} alt="LinkedIn" />
</a>
</div>
<img src={shareIcon} alt="Share icon" />
</div>
);
};

export default ShareIntegration8;
