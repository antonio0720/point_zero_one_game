import * as express from 'express';
import bodyParser from 'body-parser';
import { Sequelize } from 'sequelize-typescript';
import config from './config';
import User from './models/user';
import Role from './models/role';
import Approval from './models/approval';
import Request from './models/request';
import Approvable from './interfaces/approvable';
import { handleApprovalWorkflow } from './services/approval-workflows';

const app = express();
app.use(bodyParser.json());

const sequelize = new Sequelize({
dialect: config.dialect,
host: config.host,
port: config.port,
username: config.username,
password: config.password,
database: config.database,
models: [User, Role, Approval, Request],
synchronize: false, // Don't drop and re-create tables, change to true for initialization
});

sequelize.authenticate()
.then(() => console.log('Database connection established'))
.catch((err) => console.error('Unable to connect to the database:', err));

app.post('/approval-workflow/:id', async (req, res) => {
try {
const approvable: Approvable = req.body;
await handleApprovalWorkflow(approvable, parseInt(req.params.id));
res.status(200).json({ success: true });
} catch (err) {
console.error(err);
res.status(500).json({ error: err.message });
}
});

const PORT = config.port;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
