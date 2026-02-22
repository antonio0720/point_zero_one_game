import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeTickStreamService } from './realtime-tick-stream.service';
import { MatchmakingModule } from '../matchmaking.module';
import { Session } from '../../session/entities/session.entity';
import { GetSessionByIdResolver } from '../../session/resolvers/get-session-by-id.resolver';
import { ApolloServer, gql } from 'apollo-server-express';
import { GraphQLModule } from '@nestjs/graphql';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Connection, createConnection } from 'typeorm';
import { TickStreamGateway } from './tick-stream.gateway';

describe('RealtimeTickStreamService', () => {
let app: INestApplication;
let graphQLServer: ApolloServer;
let connection: Connection;
let realtimeTickStreamService: RealtimeTickStreamService;
let sessionRepository: typeof Session.repository;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
imports: [
MatchmakingModule,
GraphQLModule.forRoot({
autoSchemaFile: 'schema.gql',
buildSchemaOptions: {},
sortSchema: true,
}),
],
})
.overrideProvider(GetSessionByIdResolver)
.useValue(() => ({ resolve: () => {} }))
.compile();

app = moduleFixture.createNestApplication();
app.useGlobalPipes(new ValidationPipe());
graphQLServer = app.get(ApolloServer);
connection = app.get(Connection);
realtimeTickStreamService = app.get(RealtimeTickStreamService);
sessionRepository = app.get('sessionRepository');

await app.init();
});

afterAll(async () => {
await connection.close();
await app.close();
})

describe('subscribeToTicks', () => {
// your test cases here
});

describe('sendTicks', () => {
// your test cases here
});
});
