import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum IdempotencyStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('idempotency_keys')
@Index(['idempotencyKey', 'resourcePath'], { unique: true })
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, name: 'idempotency_key' })
  idempotencyKey: string;

  @Column({ length: 255, name: 'resource_path' })
  resourcePath: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: IdempotencyStatus.IN_PROGRESS,
  })
  status: IdempotencyStatus;

  @Column({ nullable: true, name: 'response_code' })
  responseCode: number;

  @Column({ type: 'jsonb', nullable: true, name: 'response_body' })
  responseBody: any;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
