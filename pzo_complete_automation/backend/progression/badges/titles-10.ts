Here's a TypeScript example for a Badge Title service in a hypothetical Progression module. This service manages the titles associated with user achievements based on their progress up to level 10.

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TitleDocument } from './schemas/title.schema';

@Injectable()
export class TitlesService {
constructor(
@InjectModel('Title') private readonly titleModel: Model<TitleDocument>,
) {}

async findTitleByProgress(progress: number): Promise<TitleDocument> {
const title = await this.titleModel
.findOne({ levelRange: { $gte: progress } })
.sort({ levelRange: 1 })
.exec();
if (!title) throw new Error('No title found for the given progress');
return title;
}
}
```

Here's the Title schema for MongoDB. This example uses Mongoose, a popular Object Data Modeling (ODM) library for MongoDB.

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TitleDocument = Title & Document;

@Schema()
export class Title {
@Prop({ required: true })
title: string;

@Prop({ required: true })
description: string;

@Prop({ required: true, type: Number })
levelRange: number[];
}

export const TitleSchema = SchemaFactory.createForClass(Title);
```
