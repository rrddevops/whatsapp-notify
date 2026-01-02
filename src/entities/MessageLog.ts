import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('message_logs')
export class MessageLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  from!: string;

  @Column({ type: 'varchar', length: 255 })
  to!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'boolean', default: false })
  isGroup!: boolean;

  @Column({ type: 'boolean', default: false })
  aiResponded!: boolean;

  @Column({ type: 'text', nullable: true })
  aiResponse?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
