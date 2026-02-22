state[event.data.key] = event.data.value;
break;
default:
throw new Error(`Unsupported event type: ${event.type}`);
}
return state;
};

const writeStateToFile = (filename: string, state: State): void => {
const output = yaml.stringify(state).trim() + '\n';
fs.writeFileSync(filename, output);
};

const main = () => {
const inputFile = path.join(__dirname, 'events_input.yaml');
const events = readEventsFromFile(inputFile);

let initialState: State = {};
for (const event of events) {
if (event.type === 'INITIAL_STATE') {
initialState = yaml.parse(event.data as string);
continue;
}
initialState = applyEventToState(initialState, event);
}

const outputFile = path.join(__dirname, 'state_output.yaml');
writeStateToFile(outputFile, initialState);
};

main();
```
