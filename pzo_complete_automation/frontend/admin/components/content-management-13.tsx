import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface ContentItem {
id: number;
title: string;
content: string;
}

const ContentManagement13 = () => {
const [contents, setContents] = useState<ContentItem[]>([]);

useEffect(() => {
fetchContents();
}, []);

const fetchContents = async () => {
try {
const response = await axios.get('/api/content-management-13');
setContents(response.data);
} catch (error) {
console.error('Error fetching contents:', error);
}
};

return (
<div>
{contents.map((content) => (
<div key={content.id}>
<h2>{content.title}</h2>
<p>{content.content}</p>
</div>
))}
</div>
);
};

export default ContentManagement13;
