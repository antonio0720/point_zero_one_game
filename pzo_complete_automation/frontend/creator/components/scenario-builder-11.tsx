import * as React from 'react';
import { useDispatch } from 'react-redux';
import { Scenario, addScenario } from '../../store/scenariosSlice';
import { ScenarioForm } from './ScenarioForm';

interface Props {}

export const ScenarioBuilder11: React.FC<Props> = () => {
const dispatch = useDispatch();

const handleAddScenario = (newScenarioData: Scenario) => {
dispatch(addScenario(newScenarioData));
};

return <ScenarioForm onSubmit={handleAddScenario} />;
};
