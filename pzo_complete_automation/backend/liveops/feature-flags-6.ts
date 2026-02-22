import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from 'nestjs-redis';
import { FeatureFlagService } from './feature-flag.service';

@Module({
imports: [
ConfigModule.forRoot(),
RedisModule.forRootAsync({
useFactory: () => ({
host: process.env.REDIS_HOST,
port: parseInt(process.env.REDIS_PORT),
password: process.env.REDIS_PASSWORD,
}),
inject: [ConfigService],
}),
],
providers: [FeatureFlagService],
exports: [FeatureFlagService],
})
export class AppModule {}
