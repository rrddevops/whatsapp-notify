import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsAppConfig1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar se a tabela já existe
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'whatsapp_config'
      );
    `);

    if (!tableExists[0]?.exists) {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_config"`);
  }
}
