```typescript
export interface Profile {
id?: number;
firstName: string;
lastName: string;
email: string;
phoneNumber?: string;
createdAt?: Date;
updatedAt?: Date;
}

export class ContestantProfile implements Profile {
id?: number;
firstName: string;
lastName: string;
email: string;
phoneNumber?: string;
createdAt?: Date;
updatedAt?: Date;

constructor(profileData: Partial<Profile>) {
Object.assign(this, profileData);
}
}
```

This code defines an interface `Profile` with properties for a contestant's basic information and timestamps. It also creates a concrete implementation of the `Profile` interface called `ContestantProfile`. The constructor for `ContestantProfile` takes a `profileData` object that extends the `Profile` interface, allowing you to easily create new instances of the class with the required data.
