import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ai_config')
export class AIConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'boolean', default: true })
  respondToGroups!: boolean;

  @Column({ type: 'boolean', default: true })
  respondToDMs!: boolean;

  @Column({ type: 'text', nullable: true })
  systemPrompt?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastUpdatedBy?: string;

  @Column({ type: 'text', nullable: true, array: true })
  allowedGroupIds?: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  wikiUrl?: string;

  @Column({ type: 'boolean', default: false })
  useWikiContext!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
