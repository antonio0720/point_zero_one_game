# PZO Taskbook Progress Ledger

Overview:
The Progress Ledger is a single, centralized repository for tracking the completion progress of tasks within Point Zero One Digital's projects. It records the phase percentage completed, blocked items, last run ID, and next task ID for each task.

Non-negotiables:
1. Strict TypeScript adherence with no usage of 'any'. All code is written in strict mode.
2. Deterministic effects to ensure consistency across runs.
3. Markdown format for easy human readability and version control.

Implementation Spec:
The Progress Ledger will be implemented as a JSON object, serialized and deserialized using JavaScript's built-in `JSON` functions. Each task will have the following properties:

```json
{
  "task_id": <unique_identifier>,
  "phase_percentage": <float_value_between_0_and_100>,
  "blocked_items": [<unique_identifier_of_blocking_item_1>, ...],
  "last_run_id": <unique_identifier_of_the_last_run>,
  "next_task_id": <unique_identifier_of_the_next_task>
}
```

Edge Cases:
1. Handling empty or incomplete data upon deserialization. In such cases, the Progress Ledger should be initialized with an empty object.
2. Duplicate task IDs should be handled by either updating existing tasks or throwing an error to prevent overwriting of data.
3. Blocked items may not always have unique identifiers. To handle this, a set data structure can be used to store blocked items for each task, ensuring no duplicates are added.
4. The Progress Ledger should be able to handle multiple runs without losing track of the last run ID or next task ID for each task. This can be achieved by updating these values after each run and persisting the Progress Ledger between runs.
