import {
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, EntityManager, In, Repository} from 'typeorm';
import {CreateTransactionPayload} from './dto/create-transaction.dto';
import {ListTransactionsFilters} from './dto/list-transactions.dto';
import {TransactionEntity} from './entities/transaction.entity';
import {TransactionStatus} from '../../common/constants/payments/transaction-status.constants';
import {definedOnly} from '../../common/utils/defined-only';
import {TransactionType} from '../../common/constants/payments/transaction-type.constants';
import {TransactionDirection} from '../../common/constants/payments/transaction-direction.constants';
import {DealEntity} from '../deals/entities/deal.entity';
import {CurrencyCode} from '../../common/constants/currency/currency.constants';
import {WalletsService} from './wallets/wallets.service';
import {DealEscrowEntity} from '../deals/entities/deal-escrow.entity';
import {EscrowStatus} from '../../common/constants/deals/deal-escrow-status.constants';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(TransactionEntity)
        private readonly transactionRepository: Repository<TransactionEntity>,
        @InjectRepository(DealEntity)
        private readonly dealRepository: Repository<DealEntity>,
        @InjectRepository(DealEscrowEntity)
        private readonly escrowRepository: Repository<DealEscrowEntity>,
        private readonly walletsService: WalletsService,
    ) {}

    async listTransactionsForUser(
        userId: string,
        filters: ListTransactionsFilters,
    ) {
        const page = filters.page ?? DEFAULT_PAGE;
        const limit = filters.limit ?? DEFAULT_LIMIT;
        const offset = (page - 1) * limit;

        const queryBuilder = this.transactionRepository
            .createQueryBuilder('transaction')
            .where('transaction.userId = :userId', {userId});

        if (filters.type) {
            queryBuilder.andWhere('transaction.type = :type', {
                type: filters.type,
            });
        }

        if (filters.status) {
            queryBuilder.andWhere('transaction.status = :status', {
                status: filters.status,
            });
        }

        if (filters.direction) {
            queryBuilder.andWhere('transaction.direction = :direction', {
                direction: filters.direction,
            });
        }

        if (filters.dealId) {
            queryBuilder.andWhere('transaction.dealId = :dealId', {
                dealId: filters.dealId,
            });
        }

        if (filters.q) {
            queryBuilder.andWhere(
                '(transaction.description ILIKE :query OR transaction.externalTxHash ILIKE :query)',
                {query: `%${filters.q}%`},
            );
        }

        if (filters.from) {
            queryBuilder.andWhere('transaction.createdAt >= :from', {
                from: new Date(filters.from),
            });
        }

        if (filters.to) {
            queryBuilder.andWhere('transaction.createdAt <= :to', {
                to: new Date(filters.to),
            });
        }

        const sort = filters.sort ?? 'recent';
        const order = (filters.order ?? 'desc').toUpperCase() as
            | 'ASC'
            | 'DESC';

        if (sort === 'amount') {
            queryBuilder
                .orderBy('transaction.amountNano', order)
                .addOrderBy('transaction.createdAt', 'DESC')
                .addOrderBy('transaction.id', 'DESC');
        } else {
            queryBuilder
                .orderBy('transaction.createdAt', order)
                .addOrderBy('transaction.id', 'DESC');
        }

        queryBuilder.skip(offset).take(limit);

        const [items, total] = await queryBuilder.getManyAndCount();
        const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

        return {
            items: items.map((item) => ({
                id: item.id,
                type: item.type,
                direction: item.direction,
                status: item.status,
                amountNano: item.amountNano,
                currency: item.currency,
                description: item.description,
                dealId: item.dealId,
                escrowId: item.escrowId,
                channelId: item.channelId,
                externalTxHash: item.externalTxHash,
                createdAt: item.createdAt,
                confirmedAt: item.confirmedAt,
                completedAt: item.completedAt,
            })),
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        };
    }

    async getTransactionForUser(userId: string, id: string) {
        const transaction = await this.transactionRepository.findOne({
            where: {id},
        });

        if (!transaction) {
            throw new NotFoundException();
        }

        if (transaction.userId !== userId) {
            throw new ForbiddenException();
        }

        return transaction;
    }

    async createTransaction(data: CreateTransactionPayload) {
        const wallet = data.depositAddress
            ? {address: data.depositAddress}
            : await this.walletsService.createEscrowWallet(
                  data.dealId ?? data.userId,
              );

        const transaction = this.transactionRepository.create({
            userId: data.userId,
            type: data.type,
            direction: data.direction,
            amountNano: data.amountNano,
            currency: data.currency ?? CurrencyCode.TON,
            status: data.status ?? TransactionStatus.PENDING,
            description: data.description ?? null,
            dealId: data.dealId ?? null,
            escrowId: data.escrowId ?? null,
            channelId: data.channelId ?? null,
            counterpartyUserId: data.counterpartyUserId ?? null,
            depositAddress: wallet.address,
            externalTxHash: data.externalTxHash ?? null,
            externalExplorerUrl: data.externalExplorerUrl ?? null,
            errorCode: data.errorCode ?? null,
            errorMessage: data.errorMessage ?? null,
            metadata: data.metadata ?? null,
        });

        const saved = await this.transactionRepository.save(transaction);

        return {
            id: saved.id,
            status: saved.status,
            currency: saved.currency,
            amountNano: saved.amountNano,
            payToAddress: saved.depositAddress,
        };
    }

    async createEscrowHold(options: {
        manager?: EntityManager;
        deal: DealEntity;
        escrow: DealEscrowEntity;
        amountNano: string;
    }): Promise<{wallet: {id: string; address: string} | null; transactionId: string}> {
        const manager = options.manager ?? this.dataSource.manager;
        const transactionRepository = manager.getRepository(TransactionEntity);
        const wallet = await this.walletsService.createEscrowWallet(
            options.deal.id,
            manager,
        );

        const transaction = transactionRepository.create({
            userId: options.deal.advertiserUserId,
            type: TransactionType.ESCROW_HOLD,
            direction: TransactionDirection.IN,
            amountNano: options.amountNano,
            currency: options.escrow.currency ?? CurrencyCode.TON,
            status: TransactionStatus.PENDING,
            description: 'Escrow hold',
            dealId: options.deal.id,
            escrowId: options.escrow.id,
            channelId: options.deal.channelId,
            depositAddress: wallet.address,
        });

        const saved = await transactionRepository.save(transaction);

        return {wallet, transactionId: saved.id};
    }

    async updateTransactionStatus(
        id: string,
        status: TransactionStatus,
        timestamps?: {
            confirmedAt?: Date | null;
            completedAt?: Date | null;
        },
    ) {
        const updatePayload = definedOnly({
            status,
            confirmedAt: timestamps?.confirmedAt,
            completedAt: timestamps?.completedAt,
        });

        await this.transactionRepository.update(id, updatePayload);
    }

    async refundEscrow(dealId: string, reason: string): Promise<void> {
        const now = new Date();
        await this.dataSource.transaction(async (manager) => {
            const dealRepository = manager.getRepository(DealEntity);
            const escrowRepository = manager.getRepository(DealEscrowEntity);
            const transactionRepository =
                manager.getRepository(TransactionEntity);

            const deal = await dealRepository.findOne({where: {id: dealId}});
            if (!deal) {
                return;
            }

            const escrow = await escrowRepository.findOne({where: {dealId}});
            if (!escrow) {
                return;
            }

            await transactionRepository.update(
                {
                    escrowId: escrow.id,
                    type: TransactionType.ESCROW_HOLD,
                    status: In([
                        TransactionStatus.CONFIRMED,
                        TransactionStatus.COMPLETED,
                        TransactionStatus.PARTIAL,
                        TransactionStatus.PENDING,
                    ]),
                },
                {
                    status: TransactionStatus.REFUNDED,
                    completedAt: now,
                    errorMessage: reason,
                },
            );

            await transactionRepository.save(
                transactionRepository.create({
                    userId: deal.advertiserUserId,
                    type: TransactionType.ESCROW_REFUND,
                    direction: TransactionDirection.OUT,
                    amountNano: escrow.paidNano ?? escrow.amountNano,
                    currency: escrow.currency,
                    status: TransactionStatus.COMPLETED,
                    description: reason,
                    dealId,
                    escrowId: escrow.id,
                }),
            );

            await escrowRepository.update(escrow.id, {
                status: EscrowStatus.REFUNDED,
                refundedAt: now,
            });

            await dealRepository.update(dealId, {
                lastActivityAt: now,
            });
        });

        this.logger.log(`Refund queued for deal ${dealId}: ${reason}`);
    }

    async releaseEscrow(dealId: string, reason: string): Promise<void> {
        const now = new Date();
        await this.dataSource.transaction(async (manager) => {
            const dealRepository = manager.getRepository(DealEntity);
            const escrowRepository = manager.getRepository(DealEscrowEntity);
            const transactionRepository =
                manager.getRepository(TransactionEntity);

            const deal = await dealRepository.findOne({where: {id: dealId}});
            if (!deal) {
                return;
            }

            const escrow = await escrowRepository.findOne({where: {dealId}});
            if (!escrow) {
                return;
            }

            await transactionRepository.save(
                transactionRepository.create({
                    userId: deal.advertiserUserId,
                    type: TransactionType.ESCROW_RELEASE,
                    direction: TransactionDirection.OUT,
                    amountNano: escrow.amountNano,
                    currency: escrow.currency,
                    status: TransactionStatus.COMPLETED,
                    description: reason,
                    dealId,
                    escrowId: escrow.id,
                }),
            );

            await escrowRepository.update(escrow.id, {
                status: EscrowStatus.RELEASED,
                releasedAt: now,
            });
        });
    }
}
