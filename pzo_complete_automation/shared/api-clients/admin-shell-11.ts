import * as adminshell from 'adminshell-js';

class AdminShellClient {
private session: adminshell.IAdminshellSession;

constructor(options: adminshell.IAdminshellOptions) {
this.session = new adminshell.AdminshellSession(options);
}

async connect() {
await this.session.connect();
}

async disconnect() {
await this.session.disconnect();
}

async executeOperation(operationId: string, inputData?: any) {
const operation = new adminshell.IOperation(operationId);
operation.setInputData(inputData);
const result = await this.session.execute(operation);
return result;
}
}
