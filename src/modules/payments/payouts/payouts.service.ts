import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {createHash} from 'crypto';
import {Repository} from 'typeorm';
import {CurrencyCode} from '../../../common/constants/currency/currency.constants';
import {TransactionDirection} from '../../../common/constants/payments/transaction-direction.constants';
import {TransactionStatus} from '../../../common/constants/payments/transaction-status.constants';
import {TransactionType} from '../../../common/constants/payments/transaction-type.constants';
import {TonTransferStatus} from '../../../common/constants/payments/ton-transfer-status.constants';
import {TonTransferType} from '../../../common/constants/payments/ton-transfer-type.constants';
import {TransactionEntity} from '../entities/transaction.entity';
import {TonTransferEntity} from '../entities/ton-transfer.entity';
import {UserWalletService} from '../wallets/user-wallet.service';
import {TonHotWalletService} from '../ton/ton-hot-wallet.service';
import {LedgerService} from '../ledger/ledger.service';
import {PayoutRequestMode} from './dto/payout-request.dto';
import {PayoutServiceError, PayoutErrorCode} from './errors/payout-service.error';

type PayoutRequestPayload = {
    userId: string;
    amountNano?: string;
    currency?: CurrencyCode;
    mode?: PayoutRequestMode;
    idempotencyKey?: string;
};

@Injectable()
export class PayoutsService {
    private readonly logger = new Logger(PayoutsService.name);

    constructor(
        private readonly ledgerService: LedgerService,
        private readonly userWalletService: UserWalletService,
        private readonly tonHotWalletService: TonHotWalletService,
        @InjectRepository(TransactionEntity)
        private readonly transactionRepository: Repository<TransactionEntity>,
        @InjectRepository(TonTransferEntity)
        private readonly transferRepository: Repository<TonTransferEntity>,
    ) {}

    async requestPayout(payload: PayoutRequestPayload) {
        const currency = payload.currency ?? CurrencyCode.TON;
        const mode = payload.mode ?? PayoutRequestMode.ALL;

        const wallet = await this.userWalletService.getWallet(payload.userId);
        if (!wallet?.tonAddress) {
            throw new PayoutServiceError(PayoutErrorCode.WALLET_NOT_CONNECTED);
        }

        const destinationAddress = wallet.tonAddress;
        let created = false;

        const transaction = await this.ledgerService.withUserLock(
            payload.userId,
            async (manager) => {
                const txRepo = manager.getRepository(TransactionEntity);

                if (payload.idempotencyKey) {
                    const existing = await txRepo.findOne({
                        where: {idempotencyKey: payload.idempotencyKey},
                    });
                    if (existing) {
                        return existing;
                    }
                }

                const balance = await this.ledgerService.getWithdrawableBalance(
                    payload.userId,
                    currency,
                    manager,
                );

                const withdrawableNano = balance.withdrawableNano;
                let amountNano = payload.amountNano ?? withdrawableNano;

                if (mode === PayoutRequestMode.AMOUNT) {
                    if (!this.isValidAmount(amountNano)) {
                        throw new PayoutServiceError(PayoutErrorCode.INVALID_AMOUNT);
                    }
                } else {
                    amountNano = withdrawableNano;
                }

                if (BigInt(amountNano) <= 0n) {
                    throw new PayoutServiceError(
                        PayoutErrorCode.INSUFFICIENT_BALANCE,
                        {
                            availableNano: withdrawableNano,
                            requestedNano: amountNano,
                        },
                    );
                }

                if (BigInt(amountNano) > BigInt(withdrawableNano)) {
                    throw new PayoutServiceError(
                        PayoutErrorCode.INSUFFICIENT_BALANCE,
                        {
                            availableNano: withdrawableNano,
                            requestedNano: amountNano,
                        },
                    );
                }

                const idempotencyKey =
                    payload.idempotencyKey ??
                    this.buildIdempotencyKey({
                        userId: payload.userId,
                        destinationAddress,
                        amountNano,
                    });

                if (!payload.idempotencyKey) {
                    const existing = await txRepo.findOne({
                        where: {idempotencyKey},
                    });
                    if (existing) {
                        return existing;
                    }
                }

                const createdTx = txRepo.create({
                    userId: payload.userId,
                    type: TransactionType.PAYOUT,
                    direction: TransactionDirection.OUT,
                    status: TransactionStatus.PENDING,
                    amountNano,
                    currency,
                    description: 'Payout request',
                    destinationAddress,
                    idempotencyKey,
                });

                const saved = await txRepo.save(createdTx);
                created = true;

                this.logger.log(
                    `[PAYOUT-REQUEST] ${JSON.stringify({
                        userId: payload.userId,
                        amountNano,
                        withdrawableNano,
                    })}`,
                );

                return saved;
            },
        );

        if (!created) {
            return this.toResponse(transaction);
        }

        const hotBalanceNano = await this.tonHotWalletService.getBalance();
        const reservedNano = await this.ledgerService.getReservedPayoutsTotal(
            currency,
        );
        const canSpendNano = hotBalanceNano - BigInt(reservedNano);

        this.logger.log(
            `[HOT-WALLET] ${JSON.stringify({
                hotBalanceNano: hotBalanceNano.toString(),
                reserveNano: reservedNano,
                canSpendNano: canSpendNano.toString(),
            })}`,
        );

        if (canSpendNano < BigInt(transaction.amountNano)) {
            await this.transactionRepository.update(transaction.id, {
                status: TransactionStatus.BLOCKED_LIQUIDITY,
                errorCode: PayoutErrorCode.INSUFFICIENT_LIQUIDITY,
                errorMessage: 'Insufficient hot wallet liquidity',
            });
            throw new PayoutServiceError(PayoutErrorCode.INSUFFICIENT_LIQUIDITY);
        }

        const isDryRun = process.env.PAYOUT_DRY_RUN === 'true';
        const hotWalletAddress = await this.tonHotWalletService.getAddress();
        const transfer = await this.createTransfer(
            transaction,
            hotWalletAddress,
            isDryRun,
        );

        if (!isDryRun) {
            try {
                await this.tonHotWalletService.sendTon({
                    toAddress: destinationAddress,
                    amountNano: BigInt(transaction.amountNano),
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                await this.transferRepository.update(transfer.id, {
                    status: TonTransferStatus.FAILED,
                    errorMessage: message,
                });
                await this.transactionRepository.update(transaction.id, {
                    status: TransactionStatus.FAILED,
                    errorCode: PayoutErrorCode.INTERNAL_ERROR,
                    errorMessage: message,
                });
                throw new PayoutServiceError(PayoutErrorCode.INTERNAL_ERROR);
            }
        }

        this.logger.log(
            `[WITHDRAW-TRANSFER] ${JSON.stringify({
                transactionId: transaction.id,
                tonTransferId: transfer.id,
                toAddress: transfer.toAddress,
                amountNano: transfer.amountNano,
                txHash: transfer.txHash,
            })}`,
        );

        const updated = await this.transactionRepository.findOne({
            where: {id: transaction.id},
        });

        return this.toResponse(updated ?? transaction);
    }

    private async createTransfer(
        transaction: TransactionEntity,
        fromAddress: string,
        isDryRun: boolean,
    ): Promise<TonTransferEntity> {
        const idempotencyKey = `withdraw_transfer:${transaction.id}`;
        const existing = await this.transferRepository.findOne({
            where: {idempotencyKey},
        });
        if (existing) {
            return existing;
        }

        const status = isDryRun
            ? TonTransferStatus.SIMULATED
            : TonTransferStatus.PENDING;

        const transfer = this.transferRepository.create({
            transactionId: transaction.id,
            network: transaction.currency,
            type: TonTransferType.WITHDRAW_TO_USER,
            status,
            toAddress: transaction.destinationAddress ?? '',
            fromAddress,
            amountNano: transaction.amountNano,
            txHash: null,
            observedAt: isDryRun ? new Date() : null,
            raw: {},
            idempotencyKey,
            errorMessage: null,
        });

        const saved = await this.transferRepository.save(transfer);

        if (isDryRun) {
            await this.transactionRepository.update(transaction.id, {
                status: TransactionStatus.COMPLETED,
                confirmedAt: new Date(),
                completedAt: new Date(),
            });
        } else {
            await this.transactionRepository.update(transaction.id, {
                status: TransactionStatus.AWAITING_CONFIRMATION,
            });
        }

        return saved;
    }

    private isValidAmount(value: string): boolean {
        if (!value || !/^\d+$/.test(value)) {
            return false;
        }
        return BigInt(value) > 0n;
    }

    private buildIdempotencyKey(options: {
        userId: string;
        destinationAddress: string;
        amountNano: string;
    }): string {
        const raw = `${options.userId}:${options.destinationAddress}:${options.amountNano}:withdraw`;
        return createHash('sha256').update(raw).digest('hex');
    }

    private toResponse(transaction: TransactionEntity) {
        return {
            payoutId: transaction.id,
            status: transaction.status,
            amountNano: transaction.amountNano,
            currency: transaction.currency,
            destinationAddress: transaction.destinationAddress,
            createdAt: transaction.createdAt.toISOString(),
        };
    }
}
