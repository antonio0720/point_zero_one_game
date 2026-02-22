import * as React from 'react';
import { useScenario } from '../context/scenario-context';
import { Step } from './step';
import { ActionIcon, Divider, Grid, Text, Tooltip, Group } from '@mantine/core';
import { IconPlay, IconStop, IconUndo, IconRedo } from '@tabler/icons';
import { useTranslation } from 'react-i18next';

export const ScenarioBuilder = () => {
const { scenarios, currentStepIndex, runScenario, stopScenario, undoLastAction, redoLastAction, canUndo, canRedo } = useScenario();
const { t } = useTranslation();

return (
<Grid>
{scenarios.map((_, index) => (
<Step key={index} index={index} isCurrent={currentStepIndex === index}>
{/* Content of each step goes here */}
</Step>
))}
<Divider my="xs" />
<Group position="apart">
<Tooltip label={t('Scenario.run')}>
<ActionIcon onClick={() => runScenario()} disabled={!scenarios.length}>
<IconPlay />
</ActionIcon>
</Tooltip>
<Tooltip label={t('Scenario.stop')}>
<ActionIcon onClick={() => stopScenario()} disabled={!currentStepIndex}>
<IconStop />
</ActionIcon>
</Tooltip>
<Tooltip label={t('Scenario.undo')}>
<ActionIcon onClick={() => undoLastAction()} disabled={!canUndo}>
<IconUndo />
</ActionIcon>
</Tooltip>
<Tooltip label={t('Scenario.redo')}>
<ActionIcon onClick={() => redoLastAction()} disabled={!canRedo}>
<IconRedo />
</ActionIcon>
</Tooltip>
</Group>
</Grid>
);
};
