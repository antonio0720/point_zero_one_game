import React from 'react';
import { useShare } from '../hooks/useShare';

interface ShareProps {
url: string;
title?: string;
description?: string;
}

const Share: React.FC<ShareProps> = ({ url, title, description }) => {
const shareData = useShare({ url, title, description });

return (
<div className="share-integration">
<h3>Share this page</h3>
<ul>
<li>
<a href={`https://twitter.com/share?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
Twitter
</a>
</li>
<li>
<a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
Facebook
</a>
</li>
<li>
<button onClick={() => navigator.share(shareData)} disabled={!navigator.share}>
Share via native share dialog
</button>
</li>
</ul>
</div>
);
};

export default Share;
