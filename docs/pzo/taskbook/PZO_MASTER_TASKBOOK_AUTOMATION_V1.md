# PZO Master Taskbook Automation V1

## Overview

This document outlines the automation of the PZO Master Taskbook using a TypeScript script that adheres to strict-mode and deterministic effects. The goal is to streamline the process of converting a DOCX file into NDJSON format, following the specified task schema.

## Non-Negotiables

1. Strict TypeScript mode: `--strict` flag must be used in all TypeScript files.
2. No usage of 'any' type. All variables should have explicit types.
3. Deterministic effects: The output should always be the same given the same input.
4. Production-grade and deployment-ready code.

## Implementation Spec

### Dependencies

- `@types/node`
- `axios`
- `convertyds`
- `jszip`

### Task Schema

Each task object in the NDJSON output should have the following structure:

```json
{
  "id": string,
  "name": string,
  "description": string,
  "phase": string,
  "status": string,
  "priority": number,
  "assignedTo": string,
  "createdAt": string,
  "updatedAt": string
}
```

### Execution Flow

1. Read the DOCX file using `convertyds`.
2. Parse the content to extract task data.
3. Transform the extracted data into the task schema format.
4. Write the transformed data as NDJSON to a specified output file.

## Edge Cases

1. If the input DOCX file is invalid or cannot be read, an error should be thrown and logged.
2. If the output file already exists, it should be overwritten unless the `--append` flag is provided. In that case, the new tasks will be appended to the existing file.
3. If any task data cannot be parsed or transformed into the task schema format, an error should be logged and the task skipped. The rest of the tasks should still be processed and written to the output file.
