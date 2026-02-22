import * as express from 'express';
import * as bodyParser from 'body-parser';
import { Router } from 'express';

const app = express();
app.use(bodyParser.json());

interface Release {
version: number;
code: string;
}

let currentRelease: Release | null = null;

const releasesRouter = Router();

function applyCurrentRelease() {
if (currentRelease) {
process.execFileSync(currentRelease.code, [], { stdio: 'inherit' });
}
}

releasesRouter.post('/apply', (req, res) => {
applyCurrentRelease();
res.sendStatus(200);
});

releasesRouter.post('/rollback/:version', (req, res) => {
const version = parseInt(req.params.version);

if (!currentRelease || currentRelease.version > version) {
for (let release of releases.slice().reverse()) {
if (release.version <= version) {
currentRelease = release;
break;
}
}
}

if (currentRelease) {
applyCurrentRelease();
res.sendStatus(200);
} else {
res.status(404).send('No release found with version ' + version);
}
});

const port = process.env.PORT || 3000;
app.use('/releases', releasesRouter);
app.listen(port, () => {
console.log(`Release console listening on port ${port}`);
});
