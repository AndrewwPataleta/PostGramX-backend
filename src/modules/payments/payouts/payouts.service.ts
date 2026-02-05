import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {createHash} from 'crypto';
import {EntityManager, Repository} from 'typeorm';
import {CurrencyCode} from '../../../common/constants/currency/currency.constants';
import {TransactionDirection} from '../../../common/constants/payments/transaction-direction.constants';
import {TransactionStatus} from '../../../common/constants/payments/transaction-status.constants';
import {TransactionType} from '../../../common/constants/payments/transaction-type.constants';
import {TransactionEntity} from '../entities/transaction.entity';
import {TonTransferEntity} from '../entities/ton-transfer.entity';
import {UserWalletService} from '../wallets/user-wallet.service';
import {LedgerService} from '../ledger/ledger.service';
import {FeesService} from '../fees/fees.service';
import {PayoutRequestMode} from './dto/payout-request.dto';
import {PayoutServiceError, PayoutErrorCode} from './errors/payout-service.error';
import {TonTransferStatus} from '../../../common/constants/payments/ton-transfer-status.constants';
import {TonTransferType} from '../../../common/constants/payments/ton-transfer-type.constants';
import {TonHotWalletService} from '../ton/ton-hot-wallet.service';

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
        private readonly feesService: FeesService,
        @InjectRepository(TransactionEntity)
        private readonly transactionRepository: Repository<TransactionEntity>,
        @InjectRepository(TonTransferEntity)
        private readonly transferRepository: Repository<TonTransferEntity>,
        private readonly tonHotWalletService: TonHotWalletService,
    ) {}

    async requestPayout(payload: PayoutRequestPayload) {
        const wallet = await this.userWalletService.getWallet(payload.userId);
        if (!wallet?.tonAddress) {
            throw new PayoutServiceError(PayoutErrorCode.WALLET_NOT_CONNECTED);
        }

        return this.requestWithdrawal({
            userId: payload.userId,
            amountNano: payload.amountNano,
            currency: payload.currency,
            mode: payload.mode,
            idempotencyKey: payload.idempotencyKey,
            toAddress: wallet.tonAddress,
        });
    }

    async requestWithdrawal(options: {
        userId: string;
        amountNano?: string;
        currency?: CurrencyCode;
        mode?: PayoutRequestMode;
        idempotencyKey?: string;
        toAddress: string;
    }) {
        const currency = options.currency ?? CurrencyCode.TON;
        const mode =
            options.mode ??
            (options.amountNano ? PayoutRequestMode.AMOUNT : PayoutRequestMode.ALL);
        const destinationAddress = options.toAddress;
        let created = false;

        this.logger.log(
            `[PAYOUT-REQUEST] start ${JSON.stringify({
                userId: options.userId,
                amountNano: options.amountNano,
                currency,
                mode,
                destinationAddress,
                idempotencyKey: options.idempotencyKey,
            })}`,
        );

        const transaction = await this.ledgerService.withUserLock(
            options.userId,
            async (manager) => {
                const txRepo = manager.getRepository(TransactionEntity);
                const transferRepo = manager.getRepository(TonTransferEntity);

                if (options.idempotencyKey) {
                    const existing = await txRepo.findOne({
                        where: {idempotencyKey: options.idempotencyKey},
                    });
                    if (existing) {
                        return existing;
                    }
                }

                const balance = await this.ledgerService.getWithdrawableBalance(
                    options.userId,
                    currency,
                    manager,
                );

                const withdrawableNano = balance.withdrawableNano;
                let amountNano = options.amountNano ?? withdrawableNano;
                let feeResult: Awaited<ReturnType<FeesService['computePayoutFees']>>;

                if (mode === PayoutRequestMode.AMOUNT) {
                    if (!this.isValidAmount(amountNano)) {
                        throw new PayoutServiceError(PayoutErrorCode.INVALID_AMOUNT);
                    }
                    feeResult = await this.feesService.validatePayout({
                        amountNano,
                        withdrawableNano,
                        currency,
                        destinationAddress,
                    });
                } else {
                    const resolved = await this.resolvePayoutAmountForAll({
                        withdrawableNano,
                        currency,
                        destinationAddress,
                    });
                    amountNano = resolved.amountNano;
                    feeResult = resolved.fees;
                    if (BigInt(amountNano) > 0n) {
                        feeResult = await this.feesService.validatePayout({
                            amountNano,
                            withdrawableNano,
                            currency,
                            destinationAddress,
                        });
                    }
                }

                if (BigInt(amountNano) <= 0n) {
                    throw new PayoutServiceError(
                        PayoutErrorCode.INSUFFICIENT_BALANCE,
                        {
                            availableNano: withdrawableNano,
                            requiredNano: feeResult.totalDebitNano,
                        },
                    );
                }

                if (BigInt(feeResult.totalDebitNano) > BigInt(withdrawableNano)) {
                    throw new PayoutServiceError(
                        PayoutErrorCode.INSUFFICIENT_BALANCE,
                        {
                            availableNano: withdrawableNano,
                            requiredNano: feeResult.totalDebitNano,
                        },
                    );
                }

                const idempotencyKey =
                    options.idempotencyKey ??
                    this.buildIdempotencyKey({
                        userId: options.userId,
                        destinationAddress,
                        amountNano,
                    });

                if (!options.idempotencyKey) {
                    const existing = await txRepo.findOne({
                        where: {idempotencyKey},
                    });
                    if (existing) {
                        return existing;
                    }
                }

                const createdTx = txRepo.create({
                    userId: options.userId,
                    type: TransactionType.PAYOUT,
                    direction: TransactionDirection.OUT,
                    status: TransactionStatus.PENDING,
                    amountNano,
                    serviceFeeNano: feeResult.serviceFeeNano,
                    networkFeeNano: feeResult.networkFeeNano,
                    totalDebitNano: feeResult.totalDebitNano,
                    feePolicyVersion: feeResult.policyVersion,
                    currency,
                    description: 'Payout request',
                    destinationAddress,
                    idempotencyKey,
                    metadata: {
                        fee: feeResult.breakdown,
                    },
                });

                const saved = await txRepo.save(createdTx);
                await this.createFeeTransactions({
                    manager,
                    payout: saved,
                    serviceFeeNano: feeResult.serviceFeeNano,
                    networkFeeNano: feeResult.networkFeeNano,
                });
                created = true;

                const idempotencyTransferKey = `withdraw:${saved.idempotencyKey}`;
                const existingTransfer = await transferRepo.findOne({
                    where: {idempotencyKey: idempotencyTransferKey},
                });
                if (!existingTransfer) {
                    const fromAddress = await this.tonHotWalletService.getAddress();
                    const transfer = transferRepo.create({
                        transactionId: saved.id,
                        dealId: saved.dealId ?? null,
                        escrowWalletId: null,
                        idempotencyKey: idempotencyTransferKey,
                        type: TonTransferType.PAYOUT,
                        status: TonTransferStatus.CREATED,
                        network: saved.currency,
                        fromAddress,
                        toAddress: destinationAddress,
                        amountNano: saved.amountNano,
                        txHash: null,
                        observedAt: null,
                        raw: {reason: 'withdrawal_request'},
                        errorMessage: null,
                    });
                    const savedTransfer = await transferRepo.save(transfer);
                    await txRepo.update(saved.id, {
                        tonTransferId: savedTransfer.id,
                    });
                }

                this.logger.log(
                    `[PAYOUT-REQUEST] created ${JSON.stringify({
                        payoutId: saved.id,
                        idempotencyKey: saved.idempotencyKey,
                        userId: options.userId,
                        amountNano,
                        withdrawableNano,
                        totalDebitNano: feeResult.totalDebitNano,
                        serviceFeeNano: feeResult.serviceFeeNano,
                        networkFeeNano: feeResult.networkFeeNano,
                        feePolicyVersion: feeResult.policyVersion,
                    })}`,
                );

                return saved;
            },
        );

        if (!created) {
            return this.toResponse(transaction);
        }

        const updated = await this.transactionRepository.findOne({
            where: {id: transaction.id},
        });

        return this.toResponse(updated ?? transaction);
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
        const raw = `${options.userId}:${options.destinationAddress}:${options.amountNano}:payout`;
        return createHash('sha256').update(raw).digest('hex');
    }

    private toResponse(transaction: TransactionEntity) {
        return {
            payoutId: transaction.id,
            status: transaction.status,
            amountNano: transaction.amountNano,
            serviceFeeNano: transaction.serviceFeeNano,
            networkFeeNano: transaction.networkFeeNano,
            totalDebitNano: transaction.totalDebitNano,
            currency: transaction.currency,
            destinationAddress: transaction.destinationAddress,
            createdAt: transaction.createdAt.toISOString(),
        };
    }

    private async resolvePayoutAmountForAll(options: {
        withdrawableNano: string;
        currency: CurrencyCode;
        destinationAddress: string;
    }): Promise<{amountNano: string; fees: Awaited<ReturnType<FeesService['computePayoutFees']>>}> {
        const withdrawable = BigInt(options.withdrawableNano);
        if (withdrawable <= 0n) {
            return {
                amountNano: '0',
                fees: await this.feesService.computePayoutFees({
                    amountNano: '0',
                    currency: options.currency,
                    destinationAddress: options.destinationAddress,
                }),
            };
        }

        let low = 0n;
        let high = withdrawable;
        let bestAmount = 0n;
        let bestFees = await this.feesService.computePayoutFees({
            amountNano: '0',
            currency: options.currency,
            destinationAddress: options.destinationAddress,
        });

        while (low < high) {
            const mid = (low + high + 1n) / 2n;
            const fees = await this.feesService.computePayoutFees({
                amountNano: mid.toString(),
                currency: options.currency,
                destinationAddress: options.destinationAddress,
            });
            if (BigInt(fees.totalDebitNano) <= withdrawable) {
                low = mid;
                bestAmount = mid;
                bestFees = fees;
            } else {
                high = mid - 1n;
            }
        }

        if (bestAmount !== low) {
            bestFees = await this.feesService.computePayoutFees({
                amountNano: low.toString(),
                currency: options.currency,
                destinationAddress: options.destinationAddress,
            });
        }

        return {amountNano: low.toString(), fees: bestFees};
    }

    private async createFeeTransactions(options: {
        manager: EntityManager;
        payout: TransactionEntity;
        serviceFeeNano: string;
        networkFeeNano: string;
    }): Promise<void> {
        const txRepo = options.manager.getRepository(TransactionEntity);

        const feeTransactions: TransactionEntity[] = [];
        if (BigInt(options.serviceFeeNano) > 0n) {
            feeTransactions.push(
                txRepo.create({
                    userId: options.payout.userId,
                    type: TransactionType.FEE,
                    direction: TransactionDirection.INTERNAL,
                    status: TransactionStatus.PENDING,
                    amountNano: options.serviceFeeNano,
                    currency: options.payout.currency,
                    description: 'Service fee charged',
                    idempotencyKey: `fee:${options.payout.id}:service`,
                    metadata: {
                        payoutId: options.payout.id,
                        feeType: 'SERVICE',
                        feePolicyVersion: options.payout.feePolicyVersion,
                    },
                }),
            );
        }

        if (BigInt(options.networkFeeNano) > 0n) {
            feeTransactions.push(
                txRepo.create({
                    userId: options.payout.userId,
                    type: TransactionType.NETWORK_FEE,
                    direction: TransactionDirection.INTERNAL,
                    status: TransactionStatus.PENDING,
                    amountNano: options.networkFeeNano,
                    currency: options.payout.currency,
                    description: 'Network fee charged',
                    idempotencyKey: `fee:${options.payout.id}:network`,
                    metadata: {
                        payoutId: options.payout.id,
                        feeType: 'NETWORK',
                        feePolicyVersion: options.payout.feePolicyVersion,
                    },
                }),
            );
        }

        if (feeTransactions.length > 0) {
            await txRepo.save(feeTransactions);
        }
    }
}
