import React from 'react';
import { ShareButton, FacebookShareButton, TwitterShareButton } from 'react-share';
import { FacebookIcon, TwitterIcon } from 'react-share';

const ShareIntegration17 = () => {
return (
<div className="flex justify-center">
<div className="bg-white rounded-lg p-6 shadow-md">
<h3 className="text-xl font-medium mb-4">Share Integration 17</h3>
<div className="flex space-x-2">
<ShareButton url="https://your-website.com" className="flex items-center space-x-2">
<FacebookShareButton url="https://your-website.com">
<FacebookIcon size={32} round={true} />
</FacebookShareButton>
<TwitterShareButton url="https://your-website.com">
<TwitterIcon size={32} round={true} />
</TwitterShareButton>
</ShareButton>
</div>
</div>
</div>
);
};

export default ShareIntegration17;
