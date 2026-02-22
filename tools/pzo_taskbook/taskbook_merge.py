import json
from typing import List, Dict

def merge_taskbooks(file_path_1: str, file_path_2: str) -> (str, str):
    with open(file_path_1, 'r') as f:
        taskbook_1 = [json.loads(line) for line in f]

    with open(file_path_2, 'r') as f:
        taskbook_2 = [json.loads(line) for line in f]

    merged_taskbook: List[Dict] = []
    seen_tasks: set = set()

    for task in taskbook_1 + taskbook_2:
        if task['task_id'] not in seen_tasks:
            merged_taskbook.append(task)
            seen_tasks.add(task['task_id'])

    merged_json = json.dumps(merged_taskbook, sort_keys=True)

    diff_report = ''
    for i, (t1, t2) in enumerate(zip(taskbook_1 + taskbook_2, taskbook_1 + taskbook_2)):
        if t1 != t2:
            diff_report += f'Difference at index {i}:\n{json.dumps(t1, indent=4)}\nvs\n{json.dumps(t2, indent=4)}\n'

    return merged_json, diff_report

if __name__ == '__main__':
    import sys
    if len(sys.argv) != 3:
        print('Usage: python taskbook_merge.py <file_path_1> <file_path_2>')
        sys.exit(1)

    file_path_1 = sys.argv[1]
    file_path_2 = sys.argv[2]

    merged_json, diff_report = merge_taskbooks(file_path_1, file_path_2)
    print(merged_json)
    print(diff_report)
