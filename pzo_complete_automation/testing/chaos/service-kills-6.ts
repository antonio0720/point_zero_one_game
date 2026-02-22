import { NestFactory } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { AppModule } from './app.module';
import { KillService, registerKillSignalHandlers } from '@nestjs/terminus';

async function bootstrap() {
const app = await NestFactory.create(AppModule);

// Register kill signal handlers to allow termination of the application gracefully
registerKillSignalHandlers(app);

// Configure chaos testing by injecting KillService and adding killers for services
app.useGlobalProviders(
[
TerminusModule.forRootAsync({
useFactory: () => ({
writers: [
new KillService([
{ name: 'Worker1', signal: 'SIGTERM' }, // Replace with your service names and signals
{ name: 'Worker2', signal: 'SIGKILL' }, // or SIGINT, SIGHUP etc.
// Add more services as needed
]),
],
}),
}),
],
);

await app.listen(3000);
}

bootstrap();
