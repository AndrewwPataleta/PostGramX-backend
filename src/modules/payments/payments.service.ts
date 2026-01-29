import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {CreateTransactionDto} from './dto/create-transaction.dto';
import {ListTransactionsFilters} from './dto/list-transactions.dto';
import {TransactionEntity} from './entities/transaction.entity';
import {TransactionStatus} from './types/transaction-status.enum';
import {definedOnly} from '../../common/utils/defined-only';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class PaymentsService {
    constructor(
        @InjectRepository(TransactionEntity)
        private readonly transactionRepository: Repository<TransactionEntity>,
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

    async createTransaction(data: CreateTransactionDto) {
        const transaction = this.transactionRepository.create({
            ...data,
            currency: data.currency ?? 'TON',
            status: data.status ?? TransactionStatus.PENDING,
        });
        return this.transactionRepository.save(transaction);
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
}
