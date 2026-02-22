export interface ID {
id: string;
}

export class UniqueID implements ID {
private static counter = 0;
public static nextId(): string {
const currentId = this.counter++;
return currentId.toString(36).padStart(18, '0');
}

constructor(private id: string) {}

public getId(): string {
return this.id;
}
}
