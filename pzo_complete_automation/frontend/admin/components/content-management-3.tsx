import React, { useState, useEffect } from 'react';
import axios from 'axios';

type Content = {
id: number;
title: string;
content: string;
};

const ContentManagement3: React.FC<any> = () => {
const [contents, setContents] = useState<Content[]>([]);
const [title, setTitle] = useState('');
const [content, setContent] = useState('');

useEffect(() => {
fetchContents();
}, []);

const fetchContents = async () => {
try {
const response = await axios.get('/api/contents');
setContents(response.data);
} catch (error) {
console.error(error);
}
};

const handleAddContent = async () => {
if (!title || !content) return;

try {
await axios.post('/api/contents', { title, content });
fetchContents();
setTitle('');
setContent('');
} catch (error) {
console.error(error);
}
};

return (
<div>
<h1>Content Management</h1>
<ul>
{contents.map((content) => (
<li key={content.id}>{content.title}</li>
))}
</ul>
<input
value={title}
onChange={(e) => setTitle(e.target.value)}
placeholder="Title"
/>
<textarea
value={content}
onChange={(e) => setContent(e.target.value)}
placeholder="Content"
/>
<button onClick={handleAddContent}>Add Content</button>
</div>
);
};

export default ContentManagement3;
