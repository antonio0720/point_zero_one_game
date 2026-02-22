enum Regime {
R1,
R2,
R3,
R4,
R5,
R6,
R7,
R8,
R9,
R10,
R11,
R12,
}

interface State {
currentRegime: Regime;
nextRegime: (state: State) => State;
events: Map<string, () => void>; // event handlers for transition triggers
}

const initialState: State = {
currentRegime: Regime.R1,
nextRegime(state: State): State {
const next = state.currentRegime + 1;
if (next > Regime.R12) return state; // loop back to R1 when reaching the end
return { ...state, currentRegime: next };
},
events: new Map(),
};

initialState.events.set("event1", () => {
console.log(`Transition triggered by event1 from regime ${initialState.currentRegime}`);
});

function transition(state: State, eventName: string): State {
if (!state.events.has(eventName)) return state; // do not trigger a non-existent event
state.events.get(eventName)();
return state.nextRegime(state);
}
