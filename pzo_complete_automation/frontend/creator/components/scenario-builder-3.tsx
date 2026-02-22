import React, { useState } from 'react';
import Draggable from 'react-draggable';
import ScenarioBlock from './ScenarioBlock';

const ScenarioBuilder3 = () => {
const [blocks, setBlocks] = useState([]);

const addBlock = (type) => {
setBlocks([...blocks, { id: blocks.length + 1, type }]);
};

return (
<div>
{blocks.map((block) => (
<Draggable key={block.id} defaultPosition={{ x: 0, y: 0 }}>
<ScenarioBlock id={block.id} type={block.type} />
</Draggable>
))}
<button onClick={() => addBlock('action')}>Add Action</button>
<button onClick={() => addBlock('condition')}>Add Condition</button>
</div>
);
};

export default ScenarioBuilder3;
