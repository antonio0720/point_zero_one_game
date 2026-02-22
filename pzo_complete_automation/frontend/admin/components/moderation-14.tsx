import React from 'react';
import { useEffect } from 'react';
import ModerationService from '../../services/ModerationService';

type Props = {};

const Moderation14: React.FC<Props> = () => {
const [items, setItems] = React.useState([]);

useEffect(() => {
const fetchData = async () => {
const result = await ModerationService.getModerationItems(14);
setItems(result);
};
fetchData();
}, []);

return (
<div>
{items.map((item) => (
<div key={item.id}>
{/* Render moderation item details */}
</div>
))}
</div>
);
};

export default Moderation14;
