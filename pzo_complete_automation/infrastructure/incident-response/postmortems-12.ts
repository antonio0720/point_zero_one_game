import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

type Incident = {
title: string;
date: Date;
description: string;
impact: string;
rootCause: string;
correctiveActions: string[];
preventativeActions: string[];
};

const incidentsDir = path.join(__dirname, 'incidents');
const outputFile = path.join(__dirname, 'postmortems.yaml');

function readIncident(filename: string): Incident {
const content = fs.readFileSync(path.join(incidentsDir, filename), 'utf-8');
return yaml.load(content) as Incident;
}

const incidents = fs
.readdirSync(incidentsDir)
.filter((filename) => path.extname(filename) === '.yaml')
.map((filename) => readIncident(filename))
.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

const postmortem = {
title: 'Security Incident Response Postmortems',
incidents,
};

fs.writeFileSync(outputFile, yaml.dump(postmortem));
