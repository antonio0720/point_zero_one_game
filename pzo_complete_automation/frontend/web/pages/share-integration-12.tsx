import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';

const ShareIntegration12 = () => {
const { id } = useParams<{ id: string }>();

useEffect(() => {
// fetch data based on the id, replace with your logic
if (id) {
fetch(`/api/share-integration/${id}`)
.then((res) => res.json())
.then((data) => console.log(data));
}
}, [id]);

return (
<div>
<h1>Share Integration 12</h1>
{/* display your content */}
</div>
);
};

export default ShareIntegration12;
