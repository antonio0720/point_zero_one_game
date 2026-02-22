import React from 'react';

interface Props {
src: string; // The URL or path to the asset image
alt?: string; // Alternative text (optional)
className?: string; // Custom CSS class name (optional)
}

const ClipStudioAsset: React.FC<Props> = ({ src, alt, className }) => {
return (
<img
src={src}
alt={alt}
className={className}
style={{ width: '100%', height: 'auto' }}
/>
);
};

export default ClipStudioAsset;
