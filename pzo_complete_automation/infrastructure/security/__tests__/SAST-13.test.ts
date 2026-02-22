import { Sast13Rule } from '../../src/infrastructure/security';
import { RuleTester } from 'eslint';

const ruleTester = new RuleTester({
parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
});

ruleTester.run('sast-13', Sast13Rule, {
valid: [
{
code: `
function foo() {}
`,
},
// Add more valid examples here
],
invalid: [
{
code: `
function foo(arg) {
if (arg === undefined) {
throw new Error('Argument is undefined');
}
}
`,
errors: ['Function "foo" may allow null or undefined arguments'],
},
// Add more invalid examples with error messages here
],
});
