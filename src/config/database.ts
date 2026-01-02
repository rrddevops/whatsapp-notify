import { DataSource } from 'typeorm';
import { ScheduledMessage } from '../entities/ScheduledMessage';
import { AIConfig } from '../entities/AIConfig';
import { MessageLog } from '../entities/MessageLog';
import { WhatsAppConfig } from '../entities/WhatsAppConfig';

const isProduction = process.env.NODE_ENV === 'production';
const migrationsPath = isProduction 
  ? ['dist/database/migrations/**/*.js']
  : ['src/database/migrations/**/*.ts'];

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'whatsapp_bot',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: [ScheduledMessage, AIConfig, MessageLog, WhatsAppConfig],
    migrations: migrationsPath,
    migrationsRun: process.env.AUTO_MIGRATE === 'true' || process.env.NODE_ENV === 'production',
  subscribers: isProduction 
    ? ['dist/database/subscribers/**/*.js']
    : ['src/database/subscribers/**/*.ts'],
});
