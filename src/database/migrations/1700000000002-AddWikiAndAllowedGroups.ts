import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWikiAndAllowedGroups1700000000002 implements MigrationInterface {
  name = 'AddWikiAndAllowedGroups1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adicionar coluna allowedGroupIds (array de strings)
    await queryRunner.query(`
      ALTER TABLE "ai_config" 
      ADD COLUMN IF NOT EXISTS "allowedGroupIds" text[];
    `);

    // Adicionar coluna wikiUrl
    await queryRunner.query(`
      ALTER TABLE "ai_config" 
      ADD COLUMN IF NOT EXISTS "wikiUrl" varchar(500);
    `);

    // Adicionar coluna useWikiContext
    await queryRunner.query(`
      ALTER TABLE "ai_config" 
      ADD COLUMN IF NOT EXISTS "useWikiContext" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_config" 
      DROP COLUMN IF EXISTS "useWikiContext";
    `);

    await queryRunner.query(`
      ALTER TABLE "ai_config" 
      DROP COLUMN IF EXISTS "wikiUrl";
    `);

    await queryRunner.query(`
      ALTER TABLE "ai_config" 
      DROP COLUMN IF EXISTS "allowedGroupIds";
    `);
  }
}
