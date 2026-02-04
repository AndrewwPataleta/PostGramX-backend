import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, EntityManager, Repository} from 'typeorm';
import {CurrencyCode} from '../../../common/constants/currency/currency.constants';
import {TransactionDirection} from '../../../common/constants/payments/transaction-direction.constants';
import {TransactionStatus} from '../../../common/constants/payments/transaction-status.constants';
import {TransactionType} from '../../../common/constants/payments/transaction-type.constants';
import {TransactionEntity} from '../entities/transaction.entity';

export type WithdrawableBalance = {
    withdrawableNano: string;
    creditsNano: string;
    debitsNano: string;
    reservedNano: string;
};

@Injectable()
export class LedgerService {
    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(TransactionEntity)
        private readonly transactionRepository: Repository<TransactionEntity>,
    ) {}

    async getWithdrawableBalance(
        userId: string,
        currency: CurrencyCode,
        manager?: EntityManager,
    ): Promise<WithdrawableBalance> {
        const repo = manager
            ? manager.getRepository(TransactionEntity)
            : this.transactionRepository;

        const row = await repo
            .createQueryBuilder('transaction')
            .select(
                `COALESCE(SUM(CASE WHEN transaction.direction = :dirIn AND transaction.status = :completed THEN transaction.amountNano ELSE 0 END), 0)::numeric`,
                'creditsNano',
            )
            .addSelect(
                `COALESCE(SUM(CASE WHEN transaction.direction = :dirOut AND transaction.status = :completed AND transaction.type = :payoutType THEN transaction.amountNano ELSE 0 END), 0)::numeric`,
                'debitsNano',
            )
            .addSelect(
                `COALESCE(SUM(CASE WHEN transaction.direction = :dirOut AND transaction.type = :payoutType AND transaction.status IN (:...reservedStatuses) THEN transaction.amountNano ELSE 0 END), 0)::numeric`,
                'reservedNano',
            )
            .where('transaction.userId = :userId', {userId})
            .andWhere('transaction.currency = :currency', {currency})
            .setParameters({
                dirIn: TransactionDirection.IN,
                dirOut: TransactionDirection.OUT,
                completed: TransactionStatus.COMPLETED,
                payoutType: TransactionType.PAYOUT,
                reservedStatuses: [
                    TransactionStatus.PENDING,
                    TransactionStatus.AWAITING_CONFIRMATION,
                    TransactionStatus.CONFIRMED,
                    TransactionStatus.BLOCKED_LIQUIDITY,
                ],
            })
            .getRawOne<{
                creditsNano: string | null;
                debitsNano: string | null;
                reservedNano: string | null;
            }>();

        const creditsNano = row?.creditsNano ?? '0';
        const debitsNano = row?.debitsNano ?? '0';
        const reservedNano = row?.reservedNano ?? '0';
        const withdrawable =
            BigInt(creditsNano) - BigInt(debitsNano) - BigInt(reservedNano);
        return {
            withdrawableNano: (withdrawable > 0n ? withdrawable : 0n).toString(),
            creditsNano,
            debitsNano,
            reservedNano,
        };
    }

    async getReservedPayoutsTotal(
        currency: CurrencyCode,
        manager?: EntityManager,
    ): Promise<string> {
        const repo = manager
            ? manager.getRepository(TransactionEntity)
            : this.transactionRepository;

        const row = await repo
            .createQueryBuilder('transaction')
            .select(
                `COALESCE(SUM(transaction.amountNano), 0)::numeric`,
                'reservedNano',
            )
            .where('transaction.currency = :currency', {currency})
            .andWhere('transaction.direction = :direction', {
                direction: TransactionDirection.OUT,
            })
            .andWhere('transaction.type = :type', {
                type: TransactionType.PAYOUT,
            })
            .andWhere('transaction.status IN (:...statuses)', {
                statuses: [
                    TransactionStatus.PENDING,
                    TransactionStatus.AWAITING_CONFIRMATION,
                    TransactionStatus.CONFIRMED,
                    TransactionStatus.BLOCKED_LIQUIDITY,
                ],
            })
            .getRawOne<{reservedNano: string | null}>();

        return row?.reservedNano ?? '0';
    }

    async withUserLock<T>(
        userId: string,
        action: (manager: EntityManager) => Promise<T>,
    ): Promise<T> {
        return this.dataSource.transaction(async (manager) => {
            await manager.query(
                'SELECT pg_advisory_xact_lock(hashtext($1))',
                [userId],
            );
            return action(manager);
        });
    }
}
