import React from 'react';

interface Props {
service: string;
title: string;
url: string;
}

const ShareIntegration13: React.FC<Props> = ({ service, title, url }) => {
const shareUrl = `https://www.${service}.com/sharesheet?title=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;

return (
<a
className="share-button"
href={shareUrl}
target="_blank"
rel="noopener noreferrer"
>
Share on {service.toUpperCase()}
</a>
);
};

export default ShareIntegration13;
