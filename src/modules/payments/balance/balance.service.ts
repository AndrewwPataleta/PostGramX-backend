import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {CurrencyCode} from '../../../common/constants/currency/currency.constants';
import {DealEscrowEntity} from '../../deals/entities/deal-escrow.entity';
import {DealEntity} from '../../deals/entities/deal.entity';
import {TransactionEntity} from '../entities/transaction.entity';
import {PayoutRequestEntity} from '../entities/payout-request.entity';
import {PublicationStatus} from '../../../common/constants/deals/publication-status.constants';
import {EscrowStatus} from '../../../common/constants/deals/deal-escrow-status.constants';
import {TransactionType} from '../../../common/constants/payments/transaction-type.constants';
import {TransactionStatus} from '../../../common/constants/payments/transaction-status.constants';
import {TransactionDirection} from '../../../common/constants/payments/transaction-direction.constants';
import {RequestStatus} from '../../../common/constants/payments/request-status.constants';
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
        @InjectRepository(PayoutRequestEntity)
        private readonly payoutRepository: Repository<PayoutRequestEntity>,
    ) {}

    async getOverview(
        userId: string,
        currencyInput?: CurrencyCode,
    ): Promise<BalanceOverviewResponse> {
        const currency = currencyInput ?? CurrencyCode.TON;
        if (!Object.values(CurrencyCode).includes(currency)) {
            throw new BalanceServiceError(BalanceErrorCode.CURRENCY_UNSUPPORTED);
        }

        const earnedRow = await this.escrowRepository
            .createQueryBuilder('escrow')
            .innerJoin(DealEntity, 'deal', 'deal.id = escrow.dealId')
            .innerJoin('deal.publication', 'publication')
            .select('COALESCE(SUM(escrow.amountNano), 0)::numeric', 'earnedNano')
            .addSelect('MAX(escrow.updatedAt)', 'lastUpdatedAt')
            .where('deal.publisherUserId = :userId', {userId})
            .andWhere('escrow.currency = :currency', {currency})
            .andWhere('publication.status = :publicationStatus', {
                publicationStatus: PublicationStatus.VERIFIED,
            })
            .andWhere('escrow.status IN (:...escrowStatuses)', {
                escrowStatuses: [
                    EscrowStatus.PAYOUT_PENDING,
                    EscrowStatus.PAID_OUT,
                ],
            })
            .getRawOne<{
                earnedNano: string | null;
                lastUpdatedAt: string | null;
            }>();

        const paidOutRow = await this.transactionRepository
            .createQueryBuilder('transaction')
            .select(
                'COALESCE(SUM(transaction.amountNano), 0)::numeric',
                'paidOutNano',
            )
            .addSelect('MAX(transaction.completedAt)', 'lastUpdatedAt')
            .where('transaction.userId = :userId', {userId})
            .andWhere('transaction.currency = :currency', {currency})
            .andWhere('transaction.type = :type', {type: TransactionType.PAYOUT})
            .andWhere('transaction.status = :status', {
                status: TransactionStatus.COMPLETED,
            })
            .andWhere('transaction.direction = :direction', {
                direction: TransactionDirection.OUT,
            })
            .getRawOne<{
                paidOutNano: string | null;
                lastUpdatedAt: string | null;
            }>();

        const pendingRow = await this.payoutRepository
            .createQueryBuilder('payout')
            .addSelect('COALESCE(SUM(payout.amountNano), 0)::numeric', 'pendingNano')
            .addSelect('MAX(payout.updatedAt)', 'lastUpdatedAt')
            .where('payout.userId = :userId', {userId})
            .andWhere('payout.currency = :currency', {currency})
            .andWhere('payout.status IN (:...statuses)', {
                statuses: [RequestStatus.CREATED, RequestStatus.PROCESSING],
            })
            .getRawOne<{
                pendingNano: string | null;
                lastUpdatedAt: string | null;
            }>();

        const earned = BigInt(earnedRow?.earnedNano ?? '0');
        const paidOut = BigInt(paidOutRow?.paidOutNano ?? '0');
        const pending = BigInt(pendingRow?.pendingNano ?? '0');

        let available = earned - paidOut - pending;
        if (available < 0n) {
            this.logger.warn(
                `Balance overview clamped negative available amount for userId=${userId}`,
            );
            available = 0n;
        }

        const lastUpdatedAt = [
            earnedRow?.lastUpdatedAt,
            paidOutRow?.lastUpdatedAt,
            pendingRow?.lastUpdatedAt,
        ]
            .filter(Boolean)
            .map((value) => new Date(value as string).getTime())
            .sort((a, b) => b - a)[0];

        const lastUpdatedAtIso = lastUpdatedAt
            ? new Date(lastUpdatedAt).toISOString()
            : new Date(0).toISOString();

        this.logger.log(
            `Balance overview userId=${userId} currency=${currency} availableNano=${available.toString()}`,
        );

        return {
            currency: CurrencyCode.TON,
            availableNano: available.toString(),
            pendingNano: pending.toString(),
            lifetimeEarnedNano: earned.toString(),
            lifetimePaidOutNano: paidOut.toString(),
            lastUpdatedAt: lastUpdatedAtIso,
        };
    }
}
