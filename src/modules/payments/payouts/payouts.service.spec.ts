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
import {FeesConfigService} from '../fees/fees-config.service';
import {FeesService} from '../fees/fees.service';

class InMemoryRepository<T extends {id?: string}> {
    data: T[] = [];

    create(entity: Partial<T>): T {
        return {...(entity as T)};
    }

    async save(entity: T | T[]): Promise<T | T[]> {
        if (Array.isArray(entity)) {
            const saved: T[] = [];
            for (const item of entity) {
                saved.push((await this.save(item)) as T);
            }
            return saved;
        }
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
    let feesService: FeesService;
    let configMap: Record<string, string>;

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
        configMap = {
            FEES_ENABLED: 'true',
            PAYOUT_SERVICE_FEE_MODE: 'FIXED',
            PAYOUT_SERVICE_FEE_FIXED_NANO: '10',
            PAYOUT_SERVICE_FEE_BPS: '50',
            PAYOUT_SERVICE_FEE_MIN_NANO: '0',
            PAYOUT_NETWORK_FEE_MODE: 'FIXED',
            PAYOUT_NETWORK_FEE_FIXED_NANO: '5',
            PAYOUT_NETWORK_FEE_MIN_NANO: '0',
        };
        const configService = {
            get: (key: string) => configMap[key],
        } as any;
        const feesConfigService = new FeesConfigService(configService);
        feesService = new FeesService(feesConfigService, tonHotWalletService);

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
                    .reduce(
                        (sum, tx) =>
                            sum + BigInt(tx.totalDebitNano ?? tx.amountNano),
                        0n,
                    );
                const completedDebits = transactionRepo.data
                    .filter(
                        (tx) =>
                            tx.direction === TransactionDirection.OUT &&
                            tx.type === TransactionType.PAYOUT &&
                            tx.status === TransactionStatus.COMPLETED,
                    )
                    .reduce(
                        (sum, tx) =>
                            sum + BigInt(tx.totalDebitNano ?? tx.amountNano),
                        0n,
                    );
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
            updateFeeTransactionsStatus: jest.fn(async (payoutId, status) => {
                transactionRepo.data
                    .filter(
                        (tx) =>
                            [TransactionType.FEE, TransactionType.NETWORK_FEE].includes(
                                tx.type,
                            ) &&
                            tx.metadata &&
                            (tx.metadata as any).payoutId === payoutId,
                    )
                    .forEach((tx) => {
                        (tx as any).status = status;
                    });
            }),
        };
    });

    const createService = () =>
        new PayoutsService(
            ledgerService,
            userWalletService,
            tonHotWalletService,
            feesService,
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
        expect(first.serviceFeeNano).toEqual(second.serviceFeeNano);
        expect(first.networkFeeNano).toEqual(second.networkFeeNano);
        expect(first.totalDebitNano).toEqual(second.totalDebitNano);
        expect(
            transactionRepo.data.filter((tx) => tx.type === TransactionType.PAYOUT),
        ).toHaveLength(1);
        expect(
            transactionRepo.data.filter((tx) =>
                [TransactionType.FEE, TransactionType.NETWORK_FEE].includes(
                    tx.type,
                ),
            ),
        ).toHaveLength(2);
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

    it('calculates ALL-mode payout with fixed fees', async () => {
        const service = createService();

        const result = await service.requestPayout({
            userId,
            currency: CurrencyCode.TON,
            mode: PayoutRequestMode.ALL,
        });

        expect(result.amountNano).toEqual('85');
        expect(result.serviceFeeNano).toEqual('10');
        expect(result.networkFeeNano).toEqual('5');
        expect(result.totalDebitNano).toEqual('100');
    });

    it('calculates ALL-mode payout with BPS fees', async () => {
        configMap.PAYOUT_SERVICE_FEE_MODE = 'BPS';
        configMap.PAYOUT_SERVICE_FEE_BPS = '500';
        configMap.PAYOUT_SERVICE_FEE_FIXED_NANO = '0';
        configMap.PAYOUT_NETWORK_FEE_FIXED_NANO = '10';
        const configService = {get: (key: string) => configMap[key]} as any;
        feesService = new FeesService(
            new FeesConfigService(configService),
            tonHotWalletService,
        );

        const service = createService();
        const result = await service.requestPayout({
            userId,
            currency: CurrencyCode.TON,
            mode: PayoutRequestMode.ALL,
        });

        const withdrawable = 100n;
        const expected = (() => {
            for (let amount = withdrawable; amount >= 0n; amount -= 1n) {
                const fee = (amount * 500n + 9999n) / 10000n;
                const total = amount + fee + 10n;
                if (total <= withdrawable) {
                    return amount;
                }
            }
            return 0n;
        })();

        expect(result.amountNano).toEqual(expected.toString());
        expect(BigInt(result.totalDebitNano)).toBeLessThanOrEqual(withdrawable);
    });

    it('cancels fee transactions when payout fails', async () => {
        tonHotWalletService.sendTon.mockRejectedValueOnce(new Error('send fail'));
        const service = createService();

        await expect(
            service.requestPayout({
                userId,
                amountNano: '10',
                currency: CurrencyCode.TON,
                mode: PayoutRequestMode.AMOUNT,
            }),
        ).rejects.toEqual(
            expect.objectContaining({code: PayoutErrorCode.INTERNAL_ERROR}),
        );

        const feeTransactions = transactionRepo.data.filter((tx) =>
            [TransactionType.FEE, TransactionType.NETWORK_FEE].includes(tx.type),
        );
        expect(feeTransactions.length).toBeGreaterThan(0);
        feeTransactions.forEach((tx) => {
            expect(tx.status).toEqual(TransactionStatus.CANCELED);
        });
    });
});
