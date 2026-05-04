import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  testUrl?: string;
}

export default registerAs<DatabaseConfig>('database', () => ({
  url: process.env.DATABASE_URL ?? '',
  testUrl: process.env.TEST_DATABASE_URL,
}));
