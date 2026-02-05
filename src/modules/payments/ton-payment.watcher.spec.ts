jest.mock('@ton/ton', () => ({}), {virtual: true});
jest.mock('@ton/crypto', () => ({}), {virtual: true});
jest.mock('telegraf', () => ({}), {virtual: true});

import {TonPaymentWatcher} from './ton-payment.watcher';
import {TonTransferEntity} from './entities/ton-transfer.entity';
import {TransactionEntity} from './entities/transaction.entity';
import {TonTransferStatus} from '../../common/constants/payments/ton-transfer-status.constants';
import {TransactionStatus} from '../../common/constants/payments/transaction-status.constants';
import {TransactionDirection} from '../../common/constants/payments/transaction-direction.constants';
import {TransactionType} from '../../common/constants/payments/transaction-type.constants';

class InMemoryRepository<T extends {id?: string}> {
    data: T[] = [];

    constructor(private readonly idFactory: () => string) {}

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

describe('TonPaymentWatcher', () => {
    it('confirms only when outgoing tx hash matches existing transfer', async () => {
        let nextId = 1;
        const idFactory = () => `id-${nextId++}`;
        const transferRepo = new InMemoryRepository<TonTransferEntity>(idFactory);
        const transactionRepo = new InMemoryRepository<TransactionEntity>(idFactory);

        const transaction = {
            id: 'tx-1',
            userId: 'user-1',
            type: TransactionType.PAYOUT,
            direction: TransactionDirection.OUT,
            status: TransactionStatus.AWAITING_CONFIRMATION,
            amountNano: '100',
            serviceFeeNano: '0',
            networkFeeNano: '0',
            totalDebitNano: '100',
            feePolicyVersion: 1,
            receivedNano: '0',
            currency: 'TON' as any,
            description: null,
            dealId: null,
            escrowId: null,
            channelId: null,
            sourceRequestId: null,
            counterpartyUserId: null,
            depositAddress: null,
            externalTxHash: null,
            externalExplorerUrl: null,
            tonTransferId: 'transfer-1',
            destinationAddress: 'EQC-test',
            idempotencyKey: 'withdraw:abc',
            errorCode: null,
            errorMessage: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            confirmedAt: null,
            completedAt: null,
            expectedObservedAfter: null,
            expectedObservedBefore: null,
            escrow: null,
        } as unknown as TransactionEntity;

        transactionRepo.data.push(transaction);
        transferRepo.data.push({
            id: 'transfer-1',
            transactionId: 'tx-1',
            dealId: null,
            escrowWalletId: null,
            idempotencyKey: 'withdraw:abc',
            status: TonTransferStatus.BROADCASTED,
            network: 'TON' as any,
            type: 'PAYOUT' as any,
            toAddress: 'EQC-test',
            fromAddress: 'EQC-hot',
            amountNano: '100',
            txHash: 'known-hash',
            observedAt: null,
            raw: {},
            errorMessage: null,
            createdAt: new Date(),
            transaction: null,
        });

        const dataSource = {
            transaction: jest.fn(async (fn: any) =>
                fn({
                    getRepository: (entity: any) => {
                        if (entity === TonTransferEntity) {
                            return transferRepo;
                        }
                        if (entity === TransactionEntity) {
                            return transactionRepo;
                        }
                        return null;
                    },
                }),
            ),
            query: jest.fn(),
        } as any;

        const watcher = new TonPaymentWatcher(
            {} as any,
            dataSource,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {findOne: jest.fn().mockResolvedValue(null)} as any,
        );

        await (watcher as any).processOutgoingTransfer({
            txHash: 'unknown-hash',
            amountNano: '100',
            fromAddress: 'EQC-hot',
            toAddress: 'EQC-test',
            observedAt: new Date(),
            raw: {},
        });

        expect(transferRepo.data[0].status).toEqual(
            TonTransferStatus.BROADCASTED,
        );
        expect(transactionRepo.data[0].status).toEqual(
            TransactionStatus.AWAITING_CONFIRMATION,
        );

        await (watcher as any).processOutgoingTransfer({
            txHash: 'known-hash',
            amountNano: '100',
            fromAddress: 'EQC-hot',
            toAddress: 'EQC-test',
            observedAt: new Date(),
            raw: {},
        });

        expect(transferRepo.data[0].status).toEqual(TonTransferStatus.CONFIRMED);
        expect(transactionRepo.data[0].status).toEqual(
            TransactionStatus.CONFIRMED,
        );
    });
});
