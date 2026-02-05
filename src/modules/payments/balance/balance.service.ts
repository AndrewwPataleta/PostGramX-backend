import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {CurrencyCode} from '../../../common/constants/currency/currency.constants';
import {DealEscrowEntity} from '../../deals/entities/deal-escrow.entity';
import {DealEntity} from '../../deals/entities/deal.entity';
import {TransactionEntity} from '../entities/transaction.entity';
import {PublicationStatus} from '../../../common/constants/deals/publication-status.constants';
import {EscrowStatus} from '../../../common/constants/deals/deal-escrow-status.constants';
import {TransactionType} from '../../../common/constants/payments/transaction-type.constants';
import {TransactionStatus} from '../../../common/constants/payments/transaction-status.constants';
import {TransactionDirection} from '../../../common/constants/payments/transaction-direction.constants';
import {BalanceServiceError, BalanceErrorCode} from './errors/balance-service.error';

export type BalanceOverviewResponse = {
    currency: 'TON';
    availableNano: string;
    pendingNano: string;
    lifetimeEarnedNano: string;
    lifetimePaidOutNano: string;
    lastUpdatedAt: string;
};

@Injectable()
export class BalanceService {
    private readonly logger = new Logger(BalanceService.name);

    constructor(
        @InjectRepository(DealEscrowEntity)
        private readonly escrowRepository: Repository<DealEscrowEntity>,
        @InjectRepository(TransactionEntity)
        private readonly transactionRepository: Repository<TransactionEntity>,
    ) {}

    async getOverview(
        userId: string,
        currencyInput?: CurrencyCode,
    ): Promise<BalanceOverviewResponse> {
        const currency = currencyInput ?? CurrencyCode.TON;

        if (!Object.values(CurrencyCode).includes(currency)) {
            throw new BalanceServiceError(
                BalanceErrorCode.CURRENCY_UNSUPPORTED,
            );
        }

        /**
         * 1️⃣ Lifetime earned
         * Всё, что пользователь заработал и может/смог вывести
         */
        const earnedRow = await this.escrowRepository
            .createQueryBuilder('escrow')
            .innerJoin(DealEntity, 'deal', 'deal.id = escrow.dealId')
            .innerJoin('deal.publication', 'publication')
            .select('COALESCE(SUM(escrow.amountNano), 0)::bigint', 'earnedNano')
            .addSelect('MAX(escrow.updatedAt)', 'lastUpdatedAt')
            .where('deal.publisherUserId = :userId', { userId })
            .andWhere('escrow.currency = :currency', { currency })
            .andWhere('publication.status = :publicationStatus', {
                publicationStatus: PublicationStatus.VERIFIED,
            })
            .andWhere('escrow.status IN (:...statuses)', {
                statuses: [
                    EscrowStatus.PAYOUT_PENDING,
                    EscrowStatus.PAID_OUT,
                ],
            })
            .getRawOne<{
                earnedNano: string;
                lastUpdatedAt: string | null;
            }>();

        /**
         * 2️⃣ Lifetime paid out
         * Реально выведенные средства
         */
        const paidOutRow = await this.transactionRepository
            .createQueryBuilder('tx')
            .select(
                'COALESCE(SUM(COALESCE(tx.totalDebitNano, tx.amountNano)), 0)::bigint',
                'paidOutNano',
            )
            .addSelect('MAX(tx.completedAt)', 'lastUpdatedAt')
            .where('tx.userId = :userId', { userId })
            .andWhere('tx.currency = :currency', { currency })
            .andWhere('tx.type = :type', {
                type: TransactionType.PAYOUT,
            })
            .andWhere('tx.direction = :direction', {
                direction: TransactionDirection.OUT,
            })
            .andWhere('tx.status = :status', {
                status: TransactionStatus.COMPLETED,
            })
            .getRawOne<{
                paidOutNano: string;
                lastUpdatedAt: string | null;
            }>();

        /**
         * 3️⃣ Pending payouts (transaction-level)
         * Деньги, по которым вывод УЖЕ запущен
         */
        const pendingTxRow = await this.transactionRepository
            .createQueryBuilder('tx')
            .select(
                'COALESCE(SUM(COALESCE(tx.totalDebitNano, tx.amountNano)), 0)::bigint',
                'pendingNano',
            )
            .addSelect('MAX(tx.updatedAt)', 'lastUpdatedAt')
            .where('tx.userId = :userId', { userId })
            .andWhere('tx.currency = :currency', { currency })
            .andWhere('tx.type = :type', {
                type: TransactionType.PAYOUT,
            })
            .andWhere('tx.direction = :direction', {
                direction: TransactionDirection.OUT,
            })
            .andWhere('tx.status IN (:...statuses)', {
                statuses: [
                    TransactionStatus.PENDING,
                    TransactionStatus.AWAITING_CONFIRMATION,
                    TransactionStatus.CONFIRMED,
                    TransactionStatus.BLOCKED_LIQUIDITY,
                ],
            })
            .getRawOne<{
                pendingNano: string;
                lastUpdatedAt: string | null;
            }>();

        /**
         * 4️⃣ Pending escrow (escrow-level)
         * PAYOUT_PENDING, НО payout-транзакция УЖЕ существует
         * → деньги зарезервированы и не доступны
         */
        const pendingEscrowRow = await this.escrowRepository
            .createQueryBuilder('escrow')
            .innerJoin(DealEntity, 'deal', 'deal.id = escrow.dealId')
            .innerJoin('deal.publication', 'publication')
            .innerJoin(
                TransactionEntity,
                'payoutTx',
                [
                    'payoutTx.sourceRequestId = escrow.payoutId',
                    'payoutTx.type = :type',
                    'payoutTx.direction = :direction',
                    'payoutTx.status IN (:...statuses)',
                ].join(' AND '),
                {
                    type: TransactionType.PAYOUT,
                    direction: TransactionDirection.OUT,
                    statuses: [
                        TransactionStatus.PENDING,
                        TransactionStatus.AWAITING_CONFIRMATION,
                        TransactionStatus.CONFIRMED,
                        TransactionStatus.BLOCKED_LIQUIDITY,
                    ],
                },
            )
            .select('COALESCE(SUM(escrow.amountNano), 0)::bigint', 'pendingNano')
            .addSelect('MAX(escrow.updatedAt)', 'lastUpdatedAt')
            .where('deal.publisherUserId = :userId', { userId })
            .andWhere('escrow.currency = :currency', { currency })
            .andWhere('publication.status = :publicationStatus', {
                publicationStatus: PublicationStatus.VERIFIED,
            })
            .andWhere('escrow.status = :status', {
                status: EscrowStatus.PAYOUT_PENDING,
            })
            .getRawOne<{
                pendingNano: string;
                lastUpdatedAt: string | null;
            }>();

        // ─────────────────────────────────────────────

        const earned = BigInt(earnedRow?.earnedNano ?? '0');
        const paidOut = BigInt(paidOutRow?.paidOutNano ?? '0');
        const pendingTx = BigInt(pendingTxRow?.pendingNano ?? '0');
        const pendingEscrow = BigInt(pendingEscrowRow?.pendingNano ?? '0');

        const pending = pendingTx + pendingEscrow;

        let available = earned - paidOut - pending;
        if (available < 0n) {
            this.logger.warn(
                `[BALANCE] Negative available clamped userId=${userId} available=${available}`,
            );
            available = 0n;
        }

        /**
         * 🧾 Диагностические логи
         */
        this.logger.log(
            [
                '[BALANCE OVERVIEW]',
                `userId=${userId}`,
                `currency=${currency}`,
                `earned=${earned}`,
                `paidOut=${paidOut}`,
                `pendingTx=${pendingTx}`,
                `pendingEscrow=${pendingEscrow}`,
                `available=${available}`,
            ].join(' | '),
        );

        const lastUpdatedAt = [
            earnedRow?.lastUpdatedAt,
            paidOutRow?.lastUpdatedAt,
            pendingTxRow?.lastUpdatedAt,
            pendingEscrowRow?.lastUpdatedAt,
        ]
            .filter(Boolean)
            .map((v) => new Date(v as string).getTime())
            .sort((a, b) => b - a)[0];

        return {
            currency,
            availableNano: available.toString(),
            pendingNano: pending.toString(),
            lifetimeEarnedNano: earned.toString(),
            lifetimePaidOutNano: paidOut.toString(),
            lastUpdatedAt: lastUpdatedAt
                ? new Date(lastUpdatedAt).toISOString()
                : new Date(0).toISOString(),
        };
    }

}
