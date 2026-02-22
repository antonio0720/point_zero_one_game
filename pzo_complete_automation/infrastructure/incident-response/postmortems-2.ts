interface IncidentReport {
title: string;
date: string;
description: string;
impactedServices: string[];
rootCause: string;
remediationSteps: string[];
lessonsLearned: string[];
}

class PostMortemGenerator {
private template = `# Postmortem - ${title}

Date: ${date}

## Description
${description}

## Impacted Services
- ${impactedServices.join("\n- ")}

## Root Cause
${rootCause}

## Remediation Steps
- ${remediationSteps.map(step => `  - ${step}`).join("\n")}

## Lessons Learned
- ${lessonsLearned.map(lesson => `  - ${lesson}`).join("\n")}
`;

constructor(private incident: IncidentReport) {}

generate(): string {
return this.template
.replace(/\\/g, '') // Remove backslashes to avoid issues with Markdown formatting
.replace('${title}', this.incident.title)
.replace('${date}', this.incident.date)
.replace('${description}', this.incident.description)
.replace('${impactedServices}', this.incident.impactedServices.join(", "))
.replace('${rootCause}', this.incident.rootCause)
.replace('${remediationSteps}', this.incident.remediationSteps.join("\n"))
.replace('${lessonsLearned}', this.incident.lessonsLearned.join("\n"));
}
}
