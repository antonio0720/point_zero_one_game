import * as React from 'react';
import { useScenario } from './useScenario';
import { ScenarioEditor } from '../editor/ScenarioEditor';
import { ScenarioItem } from '../scenario-item';
import { useEditorStyles } from '../../styles/editorStyles';

export const ScenarioBuilder15: React.FC = () => {
const classes = useEditorStyles();
const { scenario, setScenario, addStep, removeStep, updateStep } = useScenario();

return (
<div className={classes.scenarioBuilder}>
<ScenarioEditor
className={classes.editor}
value={JSON.stringify(scenario)}
onChange={(event) => setScenario(JSON.parse(event.target.value))}
/>
<ul className={classes.stepsList}>
{scenario.steps.map((step, index) => (
<ScenarioItem
key={index}
index={index}
step={step}
onUpdate={(updatedStep) => updateStep(index, updatedStep)}
onRemove={() => removeStep(index)}
/>
))}
</ul>
<button onClick={() => addStep()}>Add Step</button>
</div>
);
};
