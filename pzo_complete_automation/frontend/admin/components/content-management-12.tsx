import React from 'react';
import { useSelector } from 'react-redux';
import { selectAllContents } from './contentSlice';

const ContentManagement12 = () => {
const contents = useSelector(selectAllContents);

return (
<div>
<h1>Content Management - Component 12</h1>
<ul>
{contents.map((content) => (
<li key={content.id}>{content.title}</li>
))}
</ul>
</div>
);
};

export default ContentManagement12;
