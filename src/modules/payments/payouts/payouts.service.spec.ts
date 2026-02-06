import {PayoutsService} from './payouts.service';
import {PayoutRequestMode} from './dto/payout-request.dto';
import {PayoutErrorCode} from './errors/payout-service.error';
import {CurrencyCode} from '../../../common/constants/currency/currency.constants';
import {TransactionEntity} from '../entities/transaction.entity';
import {TransactionStatus} from '../../../common/constants/payments/transaction-status.constants';
import {TransactionDirection} from '../../../common/constants/payments/transaction-direction.constants';
import {TransactionType} from '../../../common/constants/payments/transaction-type.constants';
import {randomUUID} from 'crypto';
import {FeesConfigService} from '../fees/fees-config.service';
import {FeesService} from '../fees/fees.service';
import {TonTransferEntity} from '../entities/ton-transfer.entity';
import {TonTransferStatus} from '../../../common/constants/payments/ton-transfer-status.constants';

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
            sendTon: jest.fn().mockResolvedValue({txHash: 'tx-hash'}),
            validateDestinationAddress: jest.fn(),
        };

        const baseCredits = 100n;
        configMap = {
            FEES_ENABLED: 'true',
            PAYOUT_USER_RECEIVES_FULL_AMOUNT: 'true',
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
        const feesConfigRepository = {
            findOne: jest.fn().mockResolvedValue(null),
        };
        const feesConfigService = new FeesConfigService(
            feesConfigRepository as any,
            configService,
        );
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
            feesService,
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
            service.requestWithdrawal({
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
        expect(
            transactionRepo.data.filter((tx) => tx.type === TransactionType.PAYOUT),
        ).toHaveLength(0);
    });

    it('returns existing payout for same idempotency key', async () => {
        const service = createService();

        const first = await service.requestWithdrawal({
            userId,
            amountNano: '10',
            currency: CurrencyCode.TON,
            mode: PayoutRequestMode.AMOUNT,
            idempotencyKey: 'idempotent-key',
        });

        const second = await service.requestWithdrawal({
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
        expect(first.amountToUserNano).toEqual('10');
        expect(first.totalDebitNano).toEqual('10');
        expect(
            transactionRepo.data.filter((tx) => tx.type === TransactionType.PAYOUT),
        ).toHaveLength(1);
        expect(transferRepo.data).toHaveLength(1);
        expect(transferRepo.data[0].status).toEqual(TonTransferStatus.CREATED);
        expect(transferRepo.data[0].transactionId).toEqual(first.payoutId);
        expect(
            transactionRepo.data.filter((tx) =>
                [TransactionType.FEE, TransactionType.NETWORK_FEE].includes(
                    tx.type,
                ),
            ),
        ).toHaveLength(0);
    });

    it('prevents overdraw on concurrent requests', async () => {
        const service = createService();

        await service.requestWithdrawal({
            userId,
            amountNano: '70',
            currency: CurrencyCode.TON,
            mode: PayoutRequestMode.AMOUNT,
            idempotencyKey: 'first',
        });

        await expect(
            service.requestWithdrawal({
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

    it('calculates ALL-mode payout with full amount', async () => {
        const service = createService();

        const result = await service.requestWithdrawal({
            userId,
            currency: CurrencyCode.TON,
            mode: PayoutRequestMode.ALL,
        });

        expect(result.amountNano).toEqual('100');
        expect(result.amountToUserNano).toEqual('100');
        expect(result.serviceFeeNano).toEqual('0');
        expect(result.networkFeeNano).toEqual('0');
        expect(result.totalDebitNano).toEqual('100');
    });

    it('ignores fee configuration when full amount flag is enabled', async () => {
        configMap.PAYOUT_SERVICE_FEE_MODE = 'BPS';
        configMap.PAYOUT_SERVICE_FEE_BPS = '500';
        configMap.PAYOUT_SERVICE_FEE_FIXED_NANO = '0';
        configMap.PAYOUT_NETWORK_FEE_FIXED_NANO = '10';
        const configService = {get: (key: string) => configMap[key]} as any;
        const feesConfigRepository = {
            findOne: jest.fn().mockResolvedValue(null),
        };
        feesService = new FeesService(
            new FeesConfigService(feesConfigRepository as any, configService),
            tonHotWalletService,
        );

        const service = createService();
        const result = await service.requestWithdrawal({
            userId,
            currency: CurrencyCode.TON,
            mode: PayoutRequestMode.ALL,
        });

        expect(result.amountNano).toEqual('100');
        expect(result.amountToUserNano).toEqual('100');
        expect(result.totalDebitNano).toEqual('100');
    });

    it('stores payout request without broadcasting', async () => {
        const service = createService();

        const result = await service.requestWithdrawal({
            userId,
            amountNano: '10',
            currency: CurrencyCode.TON,
            mode: PayoutRequestMode.AMOUNT,
        });

        expect(result.status).toEqual(TransactionStatus.PENDING);
        expect(tonHotWalletService.sendTon).not.toHaveBeenCalled();
        expect(
            transactionRepo.data.filter((tx) => tx.type === TransactionType.PAYOUT),
        ).toHaveLength(1);
    });
});
