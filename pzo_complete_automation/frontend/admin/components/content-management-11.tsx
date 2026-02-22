import React from 'react';
import { ContentItemType } from '../content-item';

interface Props {
items: ContentItemType[];
onCreate: (title: string, content: string) => void;
onUpdate: (id: number, title: string, content: string) => void;
onDelete: (id: number) => void;
}

const ContentManagement11: React.FC<Props> = ({
items,
onCreate,
onUpdate,
onDelete,
}) => {
const handleCreateClick = () => {
// Open a dialog to create a new content item
// ...
if (newContentTitle && newContentContent) {
onCreate(newContentTitle, newContentContent);
}
};

const handleEditClick = (item: ContentItemType) => {
// Open a dialog to update an existing content item
// ...
if (editedTitle && editedContent) {
onUpdate(item.id, editedTitle, editedContent);
}
};

const handleDeleteClick = (id: number) => {
// Display a confirmation dialog before deleting the content item
// ...
if (confirm('Are you sure you want to delete this content?')) {
onDelete(id);
}
};

return (
<div>
{/* Render list of existing content items */}
{items.map((item) => (
<div key={item.id}>
<h3>{item.title}</h3>
<p>{item.content}</p>
<button onClick={() => handleEditClick(item)}>Edit</button>
<button onClick={() => handleDeleteClick(item.id)}>Delete</button>
</div>
))}

{/* Render a button to create a new content item */}
<button onClick={handleCreateClick}>Create Content</button>
</div>
);
};

export default ContentManagement11;
