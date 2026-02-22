interface EventEmitter {
on(eventName: string, listener: (...args: any[]) => void): this;
once(eventName: string, listener: (...args: any[]) => void): this;
off(eventName: string, listener: (...args: any[]) => void): this;
removeListener(eventName: string, listener: (...args: any[]) => void): this;
emit(eventName: string, ...args: any[]): boolean;
}
