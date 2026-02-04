import {PayoutsService} from './payouts.service';
import {PayoutRequestMode} from './dto/payout-request.dto';
import {PayoutErrorCode} from './errors/payout-service.error';
import {CurrencyCode} from '../../../common/constants/currency/currency.constants';
import {TransactionEntity} from '../entities/transaction.entity';
import {TonTransferEntity} from '../entities/ton-transfer.entity';
import {TransactionStatus} from '../../../common/constants/payments/transaction-status.constants';
import {TransactionDirection} from '../../../common/constants/payments/transaction-direction.constants';
import {TransactionType} from '../../../common/constants/payments/transaction-type.constants';
import {randomUUID} from 'crypto';

class InMemoryRepository<T extends {id?: string}> {
    data: T[] = [];

    create(entity: Partial<T>): T {
        return {...(entity as T)};
    }

    async save(entity: T): Promise<T> {
        if (!entity.id) {
            entity.id = randomUUID();
        }
        if (!(entity as any).createdAt) {
            (entity as any).createdAt = new Date();
        }
        (entity as any).updatedAt = new Date();
        this.data.push(entity);
        return entity;
    }

    async findOne(options: {where: Partial<T>}): Promise<T | null> {
        const [key, value] = Object.entries(options.where)[0] ?? [];
        if (!key) {
            return null;
        }
        return this.data.find((item) => (item as any)[key] === value) ?? null;
    }

    async update(id: string, update: Partial<T>): Promise<void> {
        const item = this.data.find((entry) => entry.id === id);
        if (item) {
            Object.assign(item, update);
        }
    }
}

describe('PayoutsService', () => {
    const userId = 'user-1';
    const destinationAddress = 'EQC-test';
    let transactionRepo: InMemoryRepository<TransactionEntity>;
    let transferRepo: InMemoryRepository<TonTransferEntity>;
    let ledgerService: any;
    let userWalletService: any;
    let tonHotWalletService: any;

    beforeEach(() => {
        transactionRepo = new InMemoryRepository<TransactionEntity>();
        transferRepo = new InMemoryRepository<TonTransferEntity>();

        userWalletService = {
            getWallet: jest.fn().mockResolvedValue({tonAddress: destinationAddress}),
        };

        tonHotWalletService = {
            getBalance: jest.fn().mockResolvedValue(1000n),
            getAddress: jest.fn().mockResolvedValue('EQC-hot'),
            sendTon: jest.fn().mockResolvedValue({txHash: null}),
        };

        const baseCredits = 100n;
        ledgerService = {
            withUserLock: jest.fn(async (_userId: string, action: any) => {
                return action({
                    getRepository: () => transactionRepo,
                });
            }),
            getWithdrawableBalance: jest.fn(async () => {
                const reserved = transactionRepo.data
                    .filter(
                        (tx) =>
                            tx.direction === TransactionDirection.OUT &&
                            tx.type === TransactionType.PAYOUT &&
                            [
                                TransactionStatus.PENDING,
                                TransactionStatus.AWAITING_CONFIRMATION,
                                TransactionStatus.CONFIRMED,
                                TransactionStatus.BLOCKED_LIQUIDITY,
                            ].includes(tx.status),
                    )
                    .reduce((sum, tx) => sum + BigInt(tx.amountNano), 0n);
                const completedDebits = transactionRepo.data
                    .filter(
                        (tx) =>
                            tx.direction === TransactionDirection.OUT &&
                            tx.type === TransactionType.PAYOUT &&
                            tx.status === TransactionStatus.COMPLETED,
                    )
                    .reduce((sum, tx) => sum + BigInt(tx.amountNano), 0n);
                const withdrawable = baseCredits - completedDebits - reserved;
                return {
                    withdrawableNano:
                        withdrawable > 0n ? withdrawable.toString() : '0',
                    creditsNano: baseCredits.toString(),
                    debitsNano: completedDebits.toString(),
                    reservedNano: reserved.toString(),
                };
            }),
            getReservedPayoutsTotal: jest.fn().mockResolvedValue('0'),
        };
    });

    const createService = () =>
        new PayoutsService(
            ledgerService,
            userWalletService,
            tonHotWalletService,
            transactionRepo as any,
            transferRepo as any,
        );

    it('rejects payout when balance is insufficient', async () => {
        ledgerService.getWithdrawableBalance.mockResolvedValueOnce({
            withdrawableNano: '0',
            creditsNano: '0',
            debitsNano: '0',
            reservedNano: '0',
        });

        const service = createService();

        await expect(
            service.requestPayout({
                userId,
                amountNano: '1',
                currency: CurrencyCode.TON,
                mode: PayoutRequestMode.AMOUNT,
            }),
        ).rejects.toEqual(
            expect.objectContaining({
                code: PayoutErrorCode.INSUFFICIENT_BALANCE,
            }),
        );
    });

    it('returns existing payout for same idempotency key', async () => {
        const service = createService();

        const first = await service.requestPayout({
            userId,
            amountNano: '10',
            currency: CurrencyCode.TON,
            mode: PayoutRequestMode.AMOUNT,
            idempotencyKey: 'idempotent-key',
        });

        const second = await service.requestPayout({
            userId,
            amountNano: '10',
            currency: CurrencyCode.TON,
            mode: PayoutRequestMode.AMOUNT,
            idempotencyKey: 'idempotent-key',
        });

        expect(first.payoutId).toEqual(second.payoutId);
        expect(transactionRepo.data).toHaveLength(1);
        expect(transferRepo.data).toHaveLength(1);
        expect(tonHotWalletService.sendTon).toHaveBeenCalledTimes(1);
    });

    it('prevents overdraw on concurrent requests', async () => {
        const service = createService();

        await service.requestPayout({
            userId,
            amountNano: '70',
            currency: CurrencyCode.TON,
            mode: PayoutRequestMode.AMOUNT,
            idempotencyKey: 'first',
        });

        await expect(
            service.requestPayout({
                userId,
                amountNano: '70',
                currency: CurrencyCode.TON,
                mode: PayoutRequestMode.AMOUNT,
                idempotencyKey: 'second',
            }),
        ).rejects.toEqual(
            expect.objectContaining({
                code: PayoutErrorCode.INSUFFICIENT_BALANCE,
            }),
        );
    });
});
