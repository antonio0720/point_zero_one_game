Here is the TypeScript file `shared/contracts/pzo_taskbook/taskbook_contract.ts` as per your specifications:

```typescript
/**
 * Taskbook Contract
 */

export enum Phase {
    PENDING = "pending",
    IN_PROGRESS = "in-progress",
    COMPLETED = "completed",
    FAILED = "failed"
}

export interface Task {
    taskId: number;
    type: string;
    phase: Phase;
    input?: any; // This is a temporary 'any' type for input, should be replaced with specific types when available.
    retryCount: number;
}

/**
 * Validation rules for Task
 */
export const validateTask = (task: Task): task is Task => {
    return (
        typeof task.taskId === "number" &&
        typeof task.type === "string" &&
        Object.values(Phase).includes(task.phase) &&
        (!!task.input && typeof task.input === "object") &&
        typeof task.retryCount === "number"
    );
};
