import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

// Load environment variables
config();

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  url:
    configService.get('POSTGRES_URL') ||
    'postgresql://news:news@localhost:5432/news',
  entities: ['src/**/*.entity.ts'],
  migrations: ['migrations/*.ts'],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
