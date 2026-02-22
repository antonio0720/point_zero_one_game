import * as path from 'path';
import * as fse from 'fs-extra';
import * as yaml from 'js-yaml';
import { Actions, Fuzzer, Mutator } from 'action-fuzzing-library';

const simulationConfigPath = path.join(__dirname, 'config.yaml');
const config = yaml.load(await fse.readFile(simulationConfigPath, 'utf8')) as {
actionDefinition: string;
inputDataPath: string;
};

// Import the specific action definition from a separate file.
import ActionDefinition from './' + config.actionDefinition;
const ActionClass = ActionDefinition.default;

const mutators: Mutator<ActionClass>[] = [
// Define your custom mutators for actions here.
];

// Initialize the fuzzer with the action class and mutators.
const fuzzHarness = new Fuzzer(ActionClass, mutators);

// Read input data from a file or any other source.
const inputData = await fse.readFile(config.inputDataPath, 'utf8');

// Start the fuzzing process with the provided input data.
fuzzHarness.fuzz(inputData).then((action) => {
// Handle the generated action here.
});
