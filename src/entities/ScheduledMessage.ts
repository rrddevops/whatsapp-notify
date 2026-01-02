import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ScheduledMessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('scheduled_messages')
export class ScheduledMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  groupId!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'timestamp' })
  scheduledAt!: Date;

  @Column({
    type: 'enum',
    enum: ScheduledMessageStatus,
    default: ScheduledMessageStatus.PENDING,
  })
  status!: ScheduledMessageStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
