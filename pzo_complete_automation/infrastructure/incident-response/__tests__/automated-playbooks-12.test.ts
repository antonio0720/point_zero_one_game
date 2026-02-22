import * as chai from 'chai';
import * as sinon from 'sinon';
import { playbook12 } from '../../ansible/roles/incident-response/tasks/playbook12.yml';
import { AnsibleModule, ExecOptions } from 'ansible-core';

describe('Security incident response - Automated Playbooks 12', () => {
let module: AnsibleModule;
const sandbox = sinon.createSandbox();

beforeEach(() => {
sandbox.stub(process, 'env').value({ ANSIBLE_FORK_MAX: '50' });
sandbox.stub(console, 'log');
module = {
exec: (command: string[], options: ExecOptions) =>
new Promise((resolve) => {
resolve([...command.map((c) => c.trim()), 'success']);
}),
} as any;
});

afterEach(() => sandbox.restore());

it('should execute playbook12 successfully', async () => {
const result = await playbook12(module as unknown as AnsibleModule);

chai.expect(result).to.be.an('object');
chai.expect(result.changed).to.be.false;
});

it('should log the execution of ansible-playbook with correct arguments', () => {
playbook12(module as unknown as AnsibleModule);

const logCall = console.log.getCall(0);
chai.expect(logCall).to.deep.include(['ansible-playbook', '-i', 'inventory.ini', '-l', 'all', '-u', 'user', '--tags', 'automated_playbooks_12']);
});
});
