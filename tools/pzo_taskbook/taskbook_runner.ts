Here is the TypeScript file `tools/pzo_taskbook/taskbook_runner.ts` following the specified rules:

```typescript
/**
 * TaskBook Runner for Point Zero One Digital
 */

import { Task } from './Task';
import { FsWriterAdapter, PatcherAdapter, ShellRunnerAdapter, TestRunnerAdapter } from './adapters';

interface ActionLogEntry {
  timestamp: Date;
  action: string;
  result?: any;
}

class TaskBookRunner {
  private actionLog: ActionLogEntry[] = [];

  public executeTask(task: Task): void {
    const adapter = this.getAdapterForTaskType(task);
    if (!adapter) {
      throw new Error(`Unsupported task type: ${task.type}`);
    }

    try {
      adapter.run(task);
      this.actionLog.push({ timestamp: new Date(), action: task.type });
    } catch (error) {
      console.error(`Error executing task ${task.type}:`, error);
      this.crashLoopProtection();
    }
  }

  private getAdapterForTaskType(task: Task): Adapter | undefined {
    switch (task.type) {
      case 'fs-write':
        return new FsWriterAdapter();
      case 'patch':
        return new PatcherAdapter();
      case 'shell':
        return new ShellRunnerAdapter();
      case 'test':
        return new TestRunnerAdapter();
      default:
        return undefined;
    }
  }

  private crashLoopProtection(): void {
    console.error('Crash loop protection triggered. Exiting...');
    process.exit(1);
  }
}

export { TaskBookRunner };
