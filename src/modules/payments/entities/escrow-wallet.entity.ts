import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import {WalletScope} from '../wallets/types/wallet-scope.enum';
import {WalletStatus} from '../wallets/types/wallet-status.enum';
import {CurrencyCode} from '../../../common/constants/currency/currency.constants';

@Entity({name: 'escrow_wallets'})
@Index('IDX_escrow_wallets_address', ['address'])
export class EscrowWalletEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'enum', enum: WalletScope})
    scope: WalletScope;

    @Column({type: 'uuid', nullable: true, unique: true})
    dealId: string | null;

    @Column({type: 'uuid', nullable: true})
    userId: string | null;

    @Column({type: 'text', unique: true})
    address: string;

    @Column({type: 'enum', enum: WalletStatus, default: WalletStatus.ACTIVE})
    status: WalletStatus;

    @Column({default: CurrencyCode.TON})
    provider: CurrencyCode;

    @Column({type: 'jsonb', nullable: true})
    metadata: Record<string, unknown> | null;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;
}
