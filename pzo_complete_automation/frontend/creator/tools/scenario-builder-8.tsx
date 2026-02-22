import React from 'react';
import { useScenario } from '@path/to/your-scenario-library';

type Props = {};

const ScenarioBuilder8: React.FC<Props> = () => {
const { scenario, isLoading, error } = useScenario('your-scenario-id');

if (isLoading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;

// Render your Scenario UI based on the provided data
// ...

return <div>{scenario}</div>;
};

export default ScenarioBuilder8;
