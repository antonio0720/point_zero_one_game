import pandas as pd
from typing import Dict, List, Tuple
from pzo_taskbook.taskbook_data import TaskbookData

def taskbook_stats(taskbook_data: TaskbookData) -> Dict[str, float]:
    """
    Calculate statistics for the taskbook.

    Args:
        taskbook_data (TaskbookData): The taskbook data object.

    Returns:
        Dict[str, float]: A dictionary containing the calculated statistics.
    """

    # Get the tasks from the taskbook data
    tasks = taskbook_data.tasks

    # Filter out completed tasks
    incomplete_tasks = [task for task in tasks if not task.completed]

    # Calculate the estimated time to complete at N tasks/hour
    num_tasks = len(incomplete_tasks)
    if num_tasks == 0:
        return {
            "estimated_time_to_complete": 0.0,
            "completion_percentage_per_phase": {phase: 1.0 for phase in taskbook_data.phases},
            "blocked_task_detection": False,
        }

    estimated_time_to_complete = (sum(task.estimated_time for task in incomplete_tasks) / num_tasks) * 60

    # Calculate the completion percentage per phase
    completion_percentage_per_phase = {}
    for phase in taskbook_data.phases:
        completion_percentage_per_phase[phase] = sum(1 for task in tasks if task.phase == phase and not task.completed) / len(tasks)

    # Detect blocked tasks
    blocked_task_detection = any(task.blocked for task in incomplete_tasks)

    return {
        "estimated_time_to_complete": estimated_time_to_complete,
        "completion_percentage_per_phase": completion_percentage_per_phase,
        "blocked_task_detection": blocked_task_detection,
    }

def main() -> None:
    # Load the taskbook data
    taskbook_data = TaskbookData.load()

    # Calculate and print the statistics
    stats = taskbook_stats(taskbook_data)
    print("Estimated time to complete:", stats["estimated_time_to_complete"], "minutes")
    for phase, completion_percentage in stats["completion_percentage_per_phase"].items():
        print(f"Completion percentage per phase ({phase}): {completion_percentage * 100:.2f}%")
    if stats["blocked_task_detection"]:
        print("Blocked task detected.")

if __name__ == "__main__":
    main()
