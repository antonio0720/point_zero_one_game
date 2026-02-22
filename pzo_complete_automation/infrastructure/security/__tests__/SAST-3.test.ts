import { RuleTester } from 'eslint';
import rule from '../lib/rules/sast-3';

const ruleTester = new RuleTester();

ruleTester.run('security-hardening - SAST-3', rule, {
valid: [
{
code: `
const sensitiveData = 'secret_key';
//...
`,
},
{
code: `
const sensitiveData = new Buffer('secret_key'.toString());
//...
`,
},
],
invalid: [
{
code: `
const sensitiveData = 'secret_key';
// Insecure: directly storing sensitive data in plain text
`,
errors: [{ messageId: 'sast3-plainText' }],
},
{
code: `
const sensitiveData = new Buffer('secret_key');
// Insecure: storing sensitive data as a Buffer without encryption
`,
errors: [{ messageId: 'sast3-bufferWithoutEncryption' }],
},
],
});
