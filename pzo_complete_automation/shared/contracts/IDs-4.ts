export type Id = number;

export interface Identifiable {
id: Id;
}

export class IdGenerator {
private static instance: IdGenerator;
private currentId: Id = 1;

private constructor() {}

public static getInstance(): IdGenerator {
if (!IdGenerator.instance) {
IdGenerator.instance = new IdGenerator();
}
return IdGenerator.instance;
}

public generateNextId(): Id {
const id = this.currentId++;
return id;
}
}
