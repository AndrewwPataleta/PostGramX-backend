import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, Repository} from 'typeorm';
import {ChannelEntity} from '../../channels/entities/channel.entity';
import {ChannelPayoutsFilters} from '../dto/channel-payouts.dto';
import {TransactionEntity} from '../entities/transaction.entity';

import {
    PaymentsPayoutsError,
    PaymentsPayoutsErrorCode,
} from './errors/payments-payouts.error';
import {TransactionStatus} from "../../../common/constants/payments/transaction-status.constants";
import {TransactionType} from "../../../common/constants/payments/transaction-type.constants";
import {TransactionDirection} from "../../../common/constants/payments/transaction-direction.constants";

const MIN_WITHDRAW_NANO = BigInt('100000000');

@Injectable()
export class PaymentsPayoutsService {
    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        @InjectRepository(TransactionEntity)
        private readonly transactionRepository: Repository<TransactionEntity>,
    ) {}

    async listChannelPayouts(
        userId: string,
        filters: ChannelPayoutsFilters,
    ) {
        const query = this.channelRepository
            .createQueryBuilder('channel')
            .where('channel.ownerUserId = :userId', {userId})
            .orWhere(
                'channel.ownerUserId IS NULL AND channel.createdByUserId = :userId',
                {userId},
            );

        if (filters.q) {
            query.andWhere(
                '(channel.title ILIKE :query OR channel.username ILIKE :query)',
                {query: `%${filters.q}%`},
            );
        }

        const channels = await query.getMany();
        if (channels.length === 0) {
            return {
                items: [],
                totals: {
                    availableNano: '0',
                },
            };
        }

        const channelIds = channels.map((channel) => channel.id);

        const creditedRows = await this.transactionRepository
            .createQueryBuilder('transaction')
            .select('transaction.channelId', 'channelId')
            .addSelect('COALESCE(SUM(transaction.amountNano), 0)', 'amount')
            .where('transaction.channelId IN (:...channelIds)', {channelIds})
            .andWhere('transaction.type IN (:...types)', {
                types: [TransactionType.ESCROW_RELEASE],
            })
            .andWhere('transaction.status = :status', {
                status: TransactionStatus.COMPLETED,
            })
            .groupBy('transaction.channelId')
            .getRawMany<{channelId: string; amount: string}>();

        const debitedRows = await this.transactionRepository
            .createQueryBuilder('transaction')
            .select('transaction.channelId', 'channelId')
            .addSelect('COALESCE(SUM(transaction.amountNano), 0)', 'amount')
            .where('transaction.channelId IN (:...channelIds)', {channelIds})
            .andWhere('transaction.type IN (:...types)', {
                types: [TransactionType.WITHDRAW],
            })
            .andWhere('transaction.status IN (:...statuses)', {
                statuses: [
                    TransactionStatus.COMPLETED,
                    TransactionStatus.PENDING,
                    TransactionStatus.AWAITING_CONFIRMATION,
                ],
            })
            .groupBy('transaction.channelId')
            .getRawMany<{channelId: string; amount: string}>();

        const creditedMap = new Map<string, bigint>();
        for (const row of creditedRows) {
            creditedMap.set(row.channelId, BigInt(row.amount ?? '0'));
        }

        const debitedMap = new Map<string, bigint>();
        for (const row of debitedRows) {
            debitedMap.set(row.channelId, BigInt(row.amount ?? '0'));
        }

        let totalAvailable = BigInt(0);

        const items = channels.map((channel) => {
            const credited = creditedMap.get(channel.id) ?? BigInt(0);
            const debited = debitedMap.get(channel.id) ?? BigInt(0);
            const available = credited - debited;
            const safeAvailable = available > 0 ? available : BigInt(0);
            totalAvailable += safeAvailable;

            return {
                channel: {
                    id: channel.id,
                    name: channel.title,
                    username: channel.username,
                    avatarUrl: null,
                },
                availableNano: safeAvailable.toString(),
                currency: 'TON',
            };
        });

        return {
            items,
            totals: {
                availableNano: totalAvailable.toString(),
            },
        };
    }

    async withdrawFromChannel(
        userId: string,
        channelId: string,
        amountNano: string,
        destinationAddress?: string,
    ) {
        let amount: bigint;
        try {
            amount = BigInt(amountNano);
        } catch (error) {
            throw new PaymentsPayoutsError(
                PaymentsPayoutsErrorCode.INVALID_AMOUNT,
            );
        }

        if (amount <= 0n) {
            throw new PaymentsPayoutsError(
                PaymentsPayoutsErrorCode.INVALID_AMOUNT,
            );
        }

        if (amount < MIN_WITHDRAW_NANO) {
            throw new PaymentsPayoutsError(
                PaymentsPayoutsErrorCode.WITHDRAW_MINIMUM,
            );
        }

        return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
            const channel = await manager
                .getRepository(ChannelEntity)
                .createQueryBuilder('channel')
                .setLock('pessimistic_write')
                .where('channel.id = :channelId', {channelId})
                .getOne();

            if (!channel) {
                throw new PaymentsPayoutsError(
                    PaymentsPayoutsErrorCode.CHANNEL_NOT_FOUND,
                );
            }

            const ownerId = channel.ownerUserId ?? channel.createdByUserId;
            if (ownerId !== userId) {
                throw new PaymentsPayoutsError(
                    PaymentsPayoutsErrorCode.FORBIDDEN,
                );
            }

            const available = await this.computeAvailableForChannel(
                manager.getRepository(TransactionEntity),
                channelId,
            );

            if (amount > available) {
                throw new PaymentsPayoutsError(
                    PaymentsPayoutsErrorCode.INSUFFICIENT_FUNDS,
                );
            }

            const transaction = manager.getRepository(TransactionEntity).create({
                userId,
                channelId,
                type: TransactionType.WITHDRAW,
                direction: TransactionDirection.OUT,
                status: TransactionStatus.PENDING,
                amountNano: amount.toString(),
                currency: 'TON',
                description: 'Channel withdrawal',
                metadata: destinationAddress
                    ? {destinationAddress}
                    : null,
            });

            const saved = await manager
                .getRepository(TransactionEntity)
                .save(transaction);

            return {
                id: saved.id,
                status: saved.status,
                amountNano: saved.amountNano,
                currency: saved.currency,
                channelId: saved.channelId,
            };
        });
    }

    private async computeAvailableForChannel(
        repository: Repository<TransactionEntity>,
        channelId: string,
    ): Promise<bigint> {
        const creditedRow = await repository
            .createQueryBuilder('transaction')
            .select('COALESCE(SUM(transaction.amountNano), 0)', 'amount')
            .where('transaction.channelId = :channelId', {channelId})
            .andWhere('transaction.type IN (:...types)', {
                types: [TransactionType.ESCROW_RELEASE],
            })
            .andWhere('transaction.status = :status', {
                status: TransactionStatus.COMPLETED,
            })
            .getRawOne<{amount: string}>();

        const debitedRow = await repository
            .createQueryBuilder('transaction')
            .select('COALESCE(SUM(transaction.amountNano), 0)', 'amount')
            .where('transaction.channelId = :channelId', {channelId})
            .andWhere('transaction.type IN (:...types)', {
                types: [TransactionType.WITHDRAW],
            })
            .andWhere('transaction.status IN (:...statuses)', {
                statuses: [
                    TransactionStatus.COMPLETED,
                    TransactionStatus.PENDING,
                    TransactionStatus.AWAITING_CONFIRMATION,
                ],
            })
            .getRawOne<{amount: string}>();

        const credited = BigInt(creditedRow?.amount ?? '0');
        const debited = BigInt(debitedRow?.amount ?? '0');
        const available = credited - debited;

        return available > 0 ? available : BigInt(0);
    }
}
