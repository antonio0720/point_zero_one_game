import * as React from 'react';
import { Box, Flex, Text } from '@chakra-ui/core';
import { ScenarioBuilderProps } from './ScenarioBuilder.types';
import { getScenario, saveScenario } from '../../api/scenarios';
import ScenarioEditor from './ScenarioEditor';
import LoadingSpinner from '../LoadingSpinner';

const ScenarioBuilder: React.FC<ScenarioBuilderProps> = ({ scenarioId }) => {
const [scenario, setScenario] = React.useState(null);
const [isSaving, setIsSaving] = React.useState(false);
const [loading, setLoading] = React.useState(true);

React.useEffect(() => {
(async () => {
const fetchedScenario = await getScenario(scenarioId);
setScenario(fetchedScenario);
setLoading(false);
})();
}, []);

const handleSave = async () => {
setIsSaving(true);
await saveScenario({ scenario });
setIsSaving(false);
};

if (loading) {
return <LoadingSpinner />;
}

return (
<Box p={4}>
<Flex justifyContent="space-between" alignItems="center">
<Text fontSize="2xl" fontWeight="bold">
Scenario Builder
</Text>
<button onClick={handleSave} disabled={isSaving}>
Save Scenario
</button>
</Flex>
{scenario && <ScenarioEditor scenario={scenario} />}
</Box>
);
};

export default ScenarioBuilder;
