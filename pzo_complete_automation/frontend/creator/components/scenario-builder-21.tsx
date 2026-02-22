import React, { useState } from 'react';
import { Button, Grid, TextField } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';
import { Scenario } from '../../models/Scenario';
import { addScenario } from '../../services/api';

const useStyles = makeStyles({
root: {
flexGrow: 1,
},
});

interface Props {}

const ScenarioBuilder21: React.FC<Props> = () => {
const classes = useStyles();
const [scenarioName, setScenarioName] = useState('');
const [scenarioDescription, setScenarioDescription] = useState('');

const handleSubmit = async (event: React.FormEvent) => {
event.preventDefault();

if (!scenarioName || !scenarioDescription) return;

try {
const scenario: Scenario = {
name: scenarioName,
description: scenarioDescription,
steps: [], // TODO: Add step management here
};

await addScenario(scenario);
alert('Scenario created successfully!');
} catch (error) {
console.error(error);
alert('An error occurred while creating the scenario.');
}
};

return (
<div className={classes.root}>
<form onSubmit={handleSubmit}>
<Grid container spacing={3}>
<Grid item xs={12}>
<TextField
label="Scenario Name"
fullWidth
value={scenarioName}
onChange={(e) => setScenarioName(e.target.value)}
/>
</Grid>
<Grid item xs={12}>
<TextField
multiline
rows={4}
label="Scenario Description"
fullWidth
value={scenarioDescription}
onChange={(e) => setScenarioDescription(e.target.value)}
/>
</Grid>
<Grid item xs={12}>
<Button type="submit" color="primary" variant="contained">
Create Scenario
</Button>
</Grid>
</Grid>
</form>
</div>
);
};

export default ScenarioBuilder21;
