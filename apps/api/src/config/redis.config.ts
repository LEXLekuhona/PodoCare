import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  url: string;
}

export default registerAs<RedisConfig>('redis', () => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
}));
