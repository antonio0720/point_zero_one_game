import { v4 as uuidv4 } from 'uuid';

export class IDService {
private static instance: IDService;
private uuids: Set<string> = new Set();
private sequences: Map<number, number[]> = new Map();

private constructor() {}

public static getInstance(): IDService {
if (!IDService.instance) {
IDService.instance = new IDService();
}
return IDService.instance;
}

public generateUUID(): string {
let id: string;
do {
id = uuidv4();
} while (this.uuids.has(id));
this.uuids.add(id);
return id;
}

public generateSequenceID(prefix: string): string | null {
const sequenceId = prefix + (this.sequences.get(prefix) ?? [0]).pop();
this.sequences.set(prefix, this.sequences.get(prefix) || []);
return sequenceId;
}
}
