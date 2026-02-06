import {TonPaymentWatcher} from './ton-payment.watcher';
import {TonTransferEntity} from './entities/ton-transfer.entity';
import {TransactionEntity} from './entities/transaction.entity';
import {TonTransferStatus} from '../../common/constants/payments/ton-transfer-status.constants';
import {TransactionStatus} from '../../common/constants/payments/transaction-status.constants';
import {TonTransferType} from '../../common/constants/payments/ton-transfer-type.constants';
import {TransactionType} from '../../common/constants/payments/transaction-type.constants';
import {TransactionDirection} from '../../common/constants/payments/transaction-direction.constants';
import {CurrencyCode} from '../../common/constants/currency/currency.constants';

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

describe('TonPaymentWatcher', () => {
    it('confirms outgoing transfers only when tx hash matches', async () => {
        let nextId = 1;
        const idFactory = () => `id-${nextId++}`;
        const transferRepo = new InMemoryRepository<TonTransferEntity>(idFactory);
        const txRepo = new InMemoryRepository<TransactionEntity>(idFactory);

        const transaction = await txRepo.save({
            id: 'tx-1',
            userId: 'user-1',
            type: TransactionType.PAYOUT,
            direction: TransactionDirection.OUT,
            status: TransactionStatus.AWAITING_CONFIRMATION,
            amountNano: '1000',
            amountToUserNano: '1000',
            serviceFeeNano: '0',
            networkFeeNano: '0',
            totalDebitNano: '1000',
            feePolicyVersion: 1,
            receivedNano: '0',
            currency: CurrencyCode.TON,
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
            destinationAddress: 'EQC-destination',
            idempotencyKey: 'withdraw:tx-1',
            errorCode: null,
            errorMessage: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            confirmedAt: null,
            completedAt: null,
            expectedObservedAfter: null,
            expectedObservedBefore: null,
        } as TransactionEntity);

        const transfer = await transferRepo.save({
            id: 'transfer-1',
            transactionId: transaction.id,
            dealId: null,
            escrowWalletId: null,
            idempotencyKey: 'withdraw:tx-1',
            type: TonTransferType.PAYOUT,
            status: TonTransferStatus.BROADCASTED,
            network: CurrencyCode.TON,
            fromAddress: 'EQC-hot',
            toAddress: 'EQC-destination',
            amountNano: '1000',
            txHash: 'match-hash',
            observedAt: null,
            raw: {},
            errorMessage: null,
            createdAt: new Date(),
            transaction: null,
        } as TonTransferEntity);

        const manager = {
            getRepository: (entity: any) => {
                if (entity === TonTransferEntity) {
                    return transferRepo;
                }
                if (entity === TransactionEntity) {
                    return txRepo;
                }
                throw new Error('Unknown repository');
            },
        };

        const dataSource = {
            transaction: jest.fn(async (fn: any) => fn(manager)),
        } as any;

        const watcher = new TonPaymentWatcher(
            {getTransactions: jest.fn()} as any,
            dataSource,
            {} as any,
            txRepo as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {sendText: jest.fn()} as any,
            {findOne: jest.fn().mockResolvedValue(null)} as any,
        );

        await (watcher as any).processOutgoingTransfer({
            txHash: 'unknown-hash',
            observedAt: new Date(),
            raw: {},
        });

        expect(transfer.status).toEqual(TonTransferStatus.BROADCASTED);
        expect(transaction.status).toEqual(
            TransactionStatus.AWAITING_CONFIRMATION,
        );

        await (watcher as any).processOutgoingTransfer({
            txHash: 'match-hash',
            observedAt: new Date(),
            raw: {},
        });

        expect(transfer.status).toEqual(TonTransferStatus.CONFIRMED);
        expect(transaction.status).toEqual(TransactionStatus.CONFIRMED);
    });
});
