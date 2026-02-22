Here's a TypeScript implementation for a weighted leaderboard system in Node.js. This example assumes you have a MongoDB database set up and uses the `mongoose` ORM.

```typescript
import { Schema, model, Document } from 'mongoose';
import { IUserDocument } from './user.model';
import { IWeightedLeaderboardDocument } from './weighted-leaderboard.interface';

export interface IWeightedLeaderboardEntry {
user: IUserDocument['_id'];
score: number;
weight: number;
}

const WeightedLeaderboardSchema = new Schema<IWeightedLeaderboardDocument>({
users: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
scores: { type: Number, required: true },
weights: { type: Number, required: true },
});

export const WeightedLeaderboard = model<IWeightedLeaderboardDocument>('WeightedLeaderboard', WeightedLeaderboardSchema);
```

To seed the database with initial data or perform operations on the leaderboards, you can create a service called `weighted-leaderboard.service.ts`.

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IWeightedLeaderboardDocument, WeightedLeaderboard } from './weighted-leaderboard.model';

@Injectable()
export class WeightedLeaderboardService {
constructor(@InjectModel(WeightedLeaderboard.name) private readonly weightedLeaderboardModel: Model<IWeightedLeaderboardDocument>) {}

async create(entries: IWeightedLeaderboardEntry[]) {
const leaderboard = new this.weightedLeaderboardModel({ users: [], scores: 0, weights: 0 });

await Promise.all(entries.map(async (entry) => {
const user = await User.findById(entry.user);

if (!user) throw new Error('User not found');

leaderboard.users.push(user._id);
leaderboard.scores += entry.score;
leaderboard.weights += entry.weight;
}));

await leaderboard.save();
}

async update(id: string, entries: IWeightedLeaderboardEntry[]) {
const leaderboard = await this.weightedLeaderboardModel.findById(id);

if (!leaderboard) throw new Error('Leaderboard not found');

// Perform the update logic here
}
}
```

Remember to import and use the `WeightedLeaderboardService` in your application's module.

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema';
import { WeightedLeaderboard, WeightedLeaderboardSchema } from './weighted-leaderboard.schema';
import { WeightedLeaderboardService } from './weighted-leaderboard.service';

@Module({
imports: [
MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
MongooseModule.forFeature([{ name: WeightedLeaderboard.name, schema: WeightedLeaderboardSchema }])
],
providers: [WeightedLeaderboardService]
})
export class AppModule {}
```
