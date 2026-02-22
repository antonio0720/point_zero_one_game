# Master Taskbook PZO Automation v1.3
=====================================

## Changelog
------------

### Added Tasks (T00451-T00500)
---------------------------

The following tasks have been added to the taskbook:

* T00451: [Task description]
* ...
* T00500: [Task description]

### Schema Changes
-----------------

The schema for the taskbook has changed. The new schema is as follows:

* `tasks`: array of objects, where each object represents a task and contains the following properties:
	+ `id`: string (unique identifier for the task)
	+ `name`: string (human-readable name for the task)
	+ `description`: string (optional description for the task)
	+ `status`: string (one of "pending", "in_progress", or "completed")
* `state`: object, where each property represents a task and contains its status

### Merging with Existing State File
---------------------------------

If you have an existing state file, you can merge it with the new taskbook schema as follows:

1. Make sure your existing state file is in the correct format (i.e., it has the same structure as the new schema).
2. Run the following command to update your state file: `taskbook update-state --file path/to/your/state/file.json`
3. The updated state file will be written to the same location.

Note: If you have any custom scripts or integrations that rely on the old taskbook schema, you may need to update them to work with the new schema.

### Example State File
---------------------

Here is an example of what a state file might look like in the new schema:

```json
{
  "tasks": [
    {
      "id": "T00451",
      "name": "Task 1",
      "description": "This is task 1.",
      "status": "pending"
    },
    {
      "id": "T00452",
      "name": "Task 2",
      "description": "This is task 2.",
      "status": "in_progress"
    }
  ],
  "state": {
    "T00451": "pending",
    "T00452": "in_progress"
  }
}
```

### API Documentation
---------------------

For more information on the API endpoints and parameters, please refer to the [API documentation](docs/api.md).

### Contributing
--------------

If you'd like to contribute to this project or report any issues, please submit a pull request or open an issue on our GitHub repository: <https://github.com/point-zero-one-digital/taskbook>
