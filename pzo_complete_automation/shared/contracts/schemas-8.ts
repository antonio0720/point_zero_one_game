import { ObjectType, Int, Float, ID, String, Field, ArgsType, Arg, InputType } from '@nestjs/graphql';

@ObjectType()
export class Person {
@Field(() => ID)
id: string;

@Field()
firstName: string;

@Field()
lastName: string;

@Field(() => Int)
age: number;

@Field(() => Float, { nullable: true })
salary: number;
}

@InputType()
export class PersonWhereUniqueInput {
@Arg('id', () => ID)
id!: string;
}

@ArgsType()
export class PersonCreateArgs {
@Arg('data', () => PersonInput)
data!: Partial<PersonInput>;
}

@InputType()
export class PersonUpdateArgs {
@Arg('update', () => PersonUpdateInput)
update!: Partial<PersonUpdateInput>;

@Arg('where', () => PersonWhereUniqueInput)
where!: PersonWhereUniqueInput;
}

@InputType()
export class PersonUpsertArgs {
@Arg('update', () => PersonUpdateInput)
update!: Partial<PersonUpdateInput>;

@Arg('create', () => PersonInput)
create!: Partial<PersonInput>;

@Arg('where', () => PersonWhereUniqueInput)
where!: PersonWhereUniqueInput;
}

@InputType()
export class PersonWhereInput {
@Arg('id', () => ID)
id?: string;

@Arg('firstName', () => String)
firstName?: string;

@Arg('lastName', () => String)
lastName?: string;

@Arg('age', () => Int)
age?: number;
}
