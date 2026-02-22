import { Injectable, OnModuleInit } from '@nestjs/common';
import { RedisClientOptions, RedisModularClient } from 'redis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FeatureFlagService implements OnModuleInit {
private readonly redis: RedisModularClient;

constructor(private configService: ConfigService) {}

onModuleInit(): any {
const redisOptions: RedisClientOptions = {
host: this.configService.get<string>('REDIS_HOST'),
port: this.configService.get<number>('REDIS_PORT'),
};

this.redis = this.clientFactory.createClient(redisOptions);
this.redis.on('error', (err) => console.error(`Error: ${err}`));
}

private get clientFactory() {
return RedisModularClient.createFromOptions({
createClient: () => new Redis.Client(this.redisOptions),
});
}

private get redisOptions(): Record<string, any> {
return {
password: this.configService.get<string>('REDIS_PASSWORD'),
db: Number(this.configService.get<number>('REDIS_DB')),
};
}

getFlag(key: string): Promise<boolean> {
return new Promise((resolve, reject) => {
this.redis.get(key, (err, value) => {
if (err) return reject(err);
resolve(value === 'true');
});
});
}
}
