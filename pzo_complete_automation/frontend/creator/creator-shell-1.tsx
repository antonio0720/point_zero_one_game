import React from 'react';
import './CreatorShell1.css'; // Assume you have a CSS file for styling

interface Props {
children?: React.ReactNode;
}

const CreatorShell1: React.FC<Props> = ({ children }) => {
return (
<div className="creator-shell-1">
{children}
</div>
);
};

export default CreatorShell1;
