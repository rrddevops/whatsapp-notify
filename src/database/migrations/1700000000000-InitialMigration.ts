import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Habilitar extensão UUID se não existir
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    
    // Tabela de mensagens agendadas
    await queryRunner.query(`
      CREATE TYPE "scheduled_message_status_enum" AS ENUM('pending', 'sent', 'failed', 'cancelled');
      
      CREATE TABLE "scheduled_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "groupId" varchar(255) NOT NULL,
        "message" text NOT NULL,
        "scheduledAt" timestamp NOT NULL,
        "status" "scheduled_message_status_enum" NOT NULL DEFAULT 'pending',
        "errorMessage" text,
        "sentAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_scheduled_messages" PRIMARY KEY ("id")
      );
    `);

    // Tabela de configuração da IA
    await queryRunner.query(`
      CREATE TABLE "ai_config" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "enabled" boolean NOT NULL DEFAULT false,
        "respondToGroups" boolean NOT NULL DEFAULT true,
        "respondToDMs" boolean NOT NULL DEFAULT true,
        "systemPrompt" text,
        "lastUpdatedBy" varchar(255),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_config" PRIMARY KEY ("id")
      );
    `);

    // Tabela de logs de mensagens
    await queryRunner.query(`
      CREATE TABLE "message_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "from" varchar(255) NOT NULL,
        "to" varchar(255) NOT NULL,
        "message" text NOT NULL,
        "isGroup" boolean NOT NULL DEFAULT false,
        "aiResponded" boolean NOT NULL DEFAULT false,
        "aiResponse" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_logs" PRIMARY KEY ("id")
      );
      
      CREATE INDEX "IDX_message_logs_from" ON "message_logs" ("from");
      CREATE INDEX "IDX_message_logs_to" ON "message_logs" ("to");
      CREATE INDEX "IDX_message_logs_createdAt" ON "message_logs" ("createdAt");
    `);

    // Tabela de configuração do WhatsApp
    await queryRunner.query(`
      CREATE TABLE "whatsapp_config" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "phoneNumber" varchar(20),
        "sessionName" varchar(255),
        "isConnected" boolean NOT NULL DEFAULT false,
        "lastConnection" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whatsapp_config" PRIMARY KEY ("id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_config"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "message_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_config"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scheduled_messages"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "scheduled_message_status_enum"`);
  }
}
