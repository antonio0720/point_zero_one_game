/**
 * Service for managing publish windows and their associated data.
 */
export interface PublishWindow {
  id: number;
  startTime: Date;
  endTime: Date;
}

export interface AuditRecord {
  windowId: number;
  action: string;
  timestamp: Date;
}

/**
 * Service for managing publish windows and their associated data.
 */
class PublishWindowsService {
  private windows: PublishWindow[];
  private audits: AuditRecord[];

  constructor() {
    this.windows = [];
    this.audits = [];
  }

  /**
   * Create a new publish window with the given start and end times.
   * @param startTime The start time of the window.
   * @param endTime The end time of the window.
   */
  public createWindow(startTime: Date, endTime: Date): PublishWindow {
    const window = { id: this.windows.length + 1, startTime, endTime };
    this.windows.push(window);
    return window;
  }

  /**
   * Update the given publish window with new data.
   * @param window The publish window to update.
   * @param data The new data for the window.
   */
  public updateWindow(window: PublishWindow, data: any): void {
    const index = this.windows.findIndex((w) => w.id === window.id);
    if (index !== -1) {
      this.windows[index] = { ...this.windows[index], ...data };
      this.audit('update', JSON.stringify(data), new Date());
    } else {
      throw new Error(`Window with id ${window.id} not found.`);
    }
  }

  /**
   * Get the publish window with the given id.
   * @param id The id of the window to get.
   */
  public getWindow(id: number): PublishWindow | undefined {
    return this.windows.find((w) => w.id === id);
  }

  /**
   * Log an audit record for the given action and data.
   * @param action The action taken.
   * @param data The data associated with the action.
   * @param timestamp The timestamp of the action.
   */
  private audit(action: string, data: any, timestamp: Date): void {
    this.audits.push({ windowId: undefined, action, timestamp });
  }
}
