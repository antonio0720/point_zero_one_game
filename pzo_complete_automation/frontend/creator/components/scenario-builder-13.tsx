import React, { useState } from 'react';
import { Scene, Action, Actor } from '../../../types';
import styles from './scenario-builder.module.css';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import AddSceneButton from '../add-scene-button/AddSceneButton';
import AddActionButton from '../add-action-button/AddActionButton';
import SceneList from './SceneList';
import ActionList from './ActionList';
import { createScenario } from '../../../../services/scenarios';

interface Props {
scenario: Scene[];
onSave: (scenario: Scene[]) => void;
}

const ScenarioBuilder13: React.FC<Props> = ({ scenario, onSave }) => {
const [selectedSceneIndex, setSelectedSceneIndex] = useState(-1);

const handleDragEnd = async (result) => {
const { destination, source } = result;

if (!destination || !source) return;

if (destination.droppableId === 'scenes' && source.droppableId === 'actions') {
const newScenario = [...scenario];

const [draggedScene] = newScenario.splice(source.index, 1);
newScenario.splice(destination.index, 0, draggedScene);

setSelectedSceneIndex(-1);
onSave(newScenario);
} else if (
destination.droppableId === 'actions' &&
source.droppableId === 'scenes'
) {
const newScenario = [...scenario];
const [draggedAction] = newScenario[source.index].actions.splice(source.index, 1);
newScenario[destination.index].actions.splice(destination.index, 0, draggedAction);
setSelectedSceneIndex(destination.index);
}
};

const saveScenario = async () => {
const savedScenario = await createScenario(scenario);
onSave(savedScenario);
};

return (
<div className={styles.container}>
<DragDropContext onDragEnd={handleDragEnd}>
<Droppable droppableId="scenes" direction="horizontal">
{(provided) => (
<div ref={provided.innerRef} {...provided.droppableProps}>
<SceneList
scenes={scenario}
selectedIndex={selectedSceneIndex}
setSelectedIndex={setSelectedSceneIndex}
provided={provided}
/>
{provided.placeholder}
</div>
)}
</Droppable>
<Droppable droppableId="actions" direction="vertical">
{(provided) => (
<div ref={provided.innerRef} {...provided.droppableProps}>
<div style={{ display: selectedSceneIndex !== -1 ? 'block' : 'none' }}>
<ActionList
sceneIndex={selectedSceneIndex}
scenario={scenario[selectedSceneIndex].actions}
provided={provided}
/>
</div>
{provided.placeholder}
</div>
)}
</Droppable>
</DragDropContext>
<AddSceneButton />
<AddActionButton />
<button onClick={saveScenario}>Save</button>
</div>
);
};

export default ScenarioBuilder13;
