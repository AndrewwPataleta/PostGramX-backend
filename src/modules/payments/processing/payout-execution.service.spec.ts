import {PayoutExecutionService} from './payout-execution.service';
import {TransactionEntity} from '../entities/transaction.entity';
import {TonTransferEntity} from '../entities/ton-transfer.entity';
import {TransactionType} from '../../../common/constants/payments/transaction-type.constants';
import {TransactionDirection} from '../../../common/constants/payments/transaction-direction.constants';
import {TransactionStatus} from '../../../common/constants/payments/transaction-status.constants';
import {TonTransferStatus} from '../../../common/constants/payments/ton-transfer-status.constants';

class InMemoryRepository<T extends {id?: string}> {
    data: T[] = [];

    constructor(private readonly idFactory: () => string) {}

    create(entity: Partial<T>): T {
        return {...(entity as T)};
    }

    async save(entity: T): Promise<T> {
        if (!entity.id) {
            entity.id = this.idFactory();
        }
        this.data.push(entity);
        return entity;
    }

    async find(options: {
        where: Partial<Record<keyof T, any>>;
        take?: number;
    }): Promise<T[]> {
        let result = this.data.filter((item) =>
            Object.entries(options.where).every(([key, value]) => {
                const current = (item as any)[key];
                if (value && value._type === 'in') {
                    return value._value.includes(current);
                }
                return current === value;
            }),
        );
        if (options.take) {
            result = result.slice(0, options.take);
        }
        return result;
    }

    async findOne(options: {where: Partial<T>}): Promise<T | null> {
        return (
            this.data.find((item) =>
                Object.entries(options.where).every(
                    ([key, value]) => (item as any)[key] === value,
                ),
            ) ?? null
        );
    }

    async update(id: string, update: Partial<T>): Promise<void> {
        const item = this.data.find((entry) => entry.id === id);
        if (item) {
            Object.assign(item, update);
        }
    }
}

describe('PayoutExecutionService', () => {
    const payoutId = 'payout-1';
    const userId = 'user-1';
    const tonAddress = 'EQC-test';
    let transactionRepo: InMemoryRepository<TransactionEntity>;
    let transferRepo: InMemoryRepository<TonTransferEntity>;

    beforeEach(() => {
        let nextId = 1;
        const idFactory = () => `id-${nextId++}`;
        transactionRepo = new InMemoryRepository<TransactionEntity>(idFactory);
        transferRepo = new InMemoryRepository<TonTransferEntity>(idFactory);
    });

    it('broadcasts once for repeated processing attempts', async () => {
        await transactionRepo.save({
            id: payoutId,
            userId,
            type: TransactionType.PAYOUT,
            direction: TransactionDirection.OUT,
            status: TransactionStatus.PENDING,
            amountNano: '1000000000',
            serviceFeeNano: '0',
            networkFeeNano: '0',
            totalDebitNano: '1000000000',
            feePolicyVersion: 1,
            receivedNano: '0',
            currency: 'TON' as any,
            description: 'Payout request',
            dealId: null,
            escrowId: null,
            channelId: null,
            sourceRequestId: null,
            counterpartyUserId: null,
            depositAddress: null,
            externalTxHash: null,
            externalExplorerUrl: null,
            tonTransferId: null,
            destinationAddress: tonAddress,
            idempotencyKey: 'payout-idempotent',
            errorCode: null,
            errorMessage: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            confirmedAt: null,
            completedAt: null,
        } as TransactionEntity);

        const manager = {
            getRepository: (entity: any) => {
                if (entity === TransactionEntity) {
                    return transactionRepo;
                }
                if (entity === TonTransferEntity) {
                    return transferRepo;
                }
                throw new Error('Unknown repository');
            },
        };

        const dataSource = {
            query: jest.fn().mockResolvedValue([{locked: true}]),
            transaction: jest.fn(async (fn: any) => fn(manager)),
        } as any;

        const schedulerRegistry = {
            addCronJob: jest.fn(),
            deleteCronJob: jest.fn(),
        } as any;

        const ledgerService = {
            getWithdrawableBalance: jest.fn().mockResolvedValue({
                withdrawableNano: '1000000000',
                creditsNano: '1000000000',
                debitsNano: '0',
                reservedNano: '0',
            }),
            getReservedPayoutsTotal: jest.fn().mockResolvedValue('0'),
            updateFeeTransactionsStatus: jest.fn(),
        };

        const tonHotWalletService = {
            getBalance: jest.fn().mockResolvedValue(2000000000n),
            sendTon: jest.fn().mockResolvedValue({txHash: null}),
        };

        const config = {
            payoutCronEverySeconds: 30,
            payoutBatchLimit: 20,
            payoutDryRun: false,
            hotWalletAddress: 'EQC-hot',
        } as any;

        const service = new PayoutExecutionService(
            schedulerRegistry,
            dataSource,
            transactionRepo as any,
            transferRepo as any,
            ledgerService as any,
            tonHotWalletService as any,
            config,
        );

        await service.processQueue();
        await service.processQueue();

        expect(transferRepo.data).toHaveLength(1);
        expect(tonHotWalletService.sendTon).toHaveBeenCalledTimes(1);
        const payout = await transactionRepo.findOne({where: {id: payoutId}});
        expect(payout?.status).toEqual(TransactionStatus.AWAITING_CONFIRMATION);
        expect(payout?.tonTransferId).toBeTruthy();
        expect(transferRepo.data[0].status).toEqual(TonTransferStatus.PENDING);
    });
});
