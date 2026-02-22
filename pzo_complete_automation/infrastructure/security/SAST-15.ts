import * as safeEval from 'safe-eval';

function evaluateSafe(code: string, context) {
try {
const result = safeEval.createSandbox(code).evaluate(context);
return result;
} catch (error) {
console.error(`Error occurred while evaluating code: ${error}`);
throw error;
}
}

// Usage example
const context = { foo: 'bar' };
const code = `console.log(context.foo)`;
evaluateSafe(code, context); // Outputs "bar"
