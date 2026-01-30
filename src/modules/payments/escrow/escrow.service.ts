import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, Repository} from 'typeorm';
import {DealEntity} from '../../deals/entities/deal.entity';
import {DealEscrowStatus} from '../../deals/types/deal-escrow-status.enum';
import {
    assertTransitionAllowed,
    DealStateError,
    isTransitionAllowed,
} from '../../deals/state/deal-state.machine';
import {mapEscrowToDealStatus} from '../../deals/state/deal-status.mapper';
import {EscrowWalletEntity} from '../entities/escrow-wallet.entity';
import {TransactionEntity} from '../entities/transaction.entity';
import {TransactionDirection} from '../types/transaction-direction.enum';
import {TransactionStatus} from '../types/transaction-status.enum';
import {TransactionType} from '../types/transaction-type.enum';
import {WalletsService} from '../wallets/wallets.service';
import {
    EscrowServiceError,
    EscrowServiceErrorCode,
} from './errors/escrow-service.error';

@Injectable()
export class EscrowService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly configService: ConfigService,
        private readonly walletsService: WalletsService,
        @InjectRepository(DealEntity)
        private readonly dealRepository: Repository<DealEntity>,
        @InjectRepository(EscrowWalletEntity)
        private readonly escrowWalletRepository: Repository<EscrowWalletEntity>,
    ) {}

    async initDealEscrow(userId: string, dealId: string, amountNano: string) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new EscrowServiceError(EscrowServiceErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.advertiserUserId !== userId) {
            throw new EscrowServiceError(EscrowServiceErrorCode.FORBIDDEN);
        }

        if (deal.escrowStatus === DealEscrowStatus.PAYMENT_AWAITING) {
            if (deal.escrowAmountNano && deal.escrowAmountNano !== amountNano) {
                throw new EscrowServiceError(
                    EscrowServiceErrorCode.ESCROW_AMOUNT_MISMATCH,
                );
            }

            if (deal.escrowWalletId) {
                const wallet = await this.escrowWalletRepository.findOne({
                    where: {id: deal.escrowWalletId},
                });

                return {
                    dealId: deal.id,
                    escrowStatus: deal.escrowStatus,
                    depositAddress: wallet?.address ?? null,
                    expiresAt: deal.escrowExpiresAt,
                };
            }
        }

        if (deal.escrowStatus !== DealEscrowStatus.PAYMENT_AWAITING) {
            this.ensureTransitionAllowed(
                deal.escrowStatus,
                DealEscrowStatus.PAYMENT_AWAITING,
            );
        }

        const now = new Date();
        const expiresAt = this.calculatePaymentExpiry(now);

        const wallet = await this.dataSource.transaction(async (manager) => {
            const createdWallet = await this.walletsService.createDealEscrowWallet(
                deal.id,
                manager,
            );

            await manager.getRepository(DealEntity).update(deal.id, {
                escrowStatus: DealEscrowStatus.PAYMENT_AWAITING,
                status: mapEscrowToDealStatus(
                    DealEscrowStatus.PAYMENT_AWAITING,
                ),
                escrowWalletId: createdWallet.id,
                escrowAmountNano: amountNano,
                escrowCurrency: 'TON',
                escrowExpiresAt: expiresAt,
                lastActivityAt: now,
                stalledAt: null,
                cancelReason: null,
            });

            return createdWallet;
        });

        return {
            dealId: deal.id,
            escrowStatus: DealEscrowStatus.PAYMENT_AWAITING,
            depositAddress: wallet.address,
            expiresAt,
        };
    }

    async getDealEscrowStatus(userId: string, dealId: string) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new EscrowServiceError(EscrowServiceErrorCode.DEAL_NOT_FOUND);
        }

        if (
            deal.advertiserUserId !== userId &&
            deal.publisherOwnerUserId !== userId
        ) {
            throw new EscrowServiceError(EscrowServiceErrorCode.FORBIDDEN);
        }

        const wallet = deal.escrowWalletId
            ? await this.escrowWalletRepository.findOne({
                  where: {id: deal.escrowWalletId},
              })
            : null;

        return {
            dealId: deal.id,
            escrowStatus: deal.escrowStatus,
            depositAddress: wallet?.address ?? null,
            amountNano: deal.escrowAmountNano,
            expiresAt: deal.escrowExpiresAt,
            lastActivityAt: deal.lastActivityAt,
        };
    }

    async mockConfirmDealEscrow(
        userId: string,
        dealId: string,
        externalTxHash?: string,
    ) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new EscrowServiceError(EscrowServiceErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.advertiserUserId !== userId) {
            throw new EscrowServiceError(EscrowServiceErrorCode.FORBIDDEN);
        }

        if (!deal.escrowWalletId) {
            throw new EscrowServiceError(
                EscrowServiceErrorCode.ESCROW_WALLET_MISSING,
            );
        }

        if (!deal.escrowAmountNano) {
            throw new EscrowServiceError(
                EscrowServiceErrorCode.ESCROW_AMOUNT_NOT_SET,
            );
        }

        if (deal.escrowStatus === DealEscrowStatus.FUNDS_CONFIRMED) {
            return {
                dealId: deal.id,
                escrowStatus: deal.escrowStatus,
            };
        }

        const canMoveToPending = isTransitionAllowed(
            deal.escrowStatus,
            DealEscrowStatus.FUNDS_PENDING,
        );
        const canMoveToConfirmed = isTransitionAllowed(
            deal.escrowStatus,
            DealEscrowStatus.FUNDS_CONFIRMED,
        );

        if (!canMoveToPending && !canMoveToConfirmed) {
            throw new EscrowServiceError(
                EscrowServiceErrorCode.INVALID_TRANSITION,
            );
        }

        const wallet = await this.escrowWalletRepository.findOne({
            where: {id: deal.escrowWalletId},
        });

        if (!wallet) {
            throw new EscrowServiceError(
                EscrowServiceErrorCode.ESCROW_WALLET_MISSING,
            );
        }

        const now = new Date();

        await this.dataSource.transaction(async (manager) => {
            const dealRepository = manager.getRepository(DealEntity);

            if (canMoveToPending) {
                this.ensureTransitionAllowed(
                    deal.escrowStatus,
                    DealEscrowStatus.FUNDS_PENDING,
                );
                await dealRepository.update(deal.id, {
                    escrowStatus: DealEscrowStatus.FUNDS_PENDING,
                    status: mapEscrowToDealStatus(
                        DealEscrowStatus.FUNDS_PENDING,
                    ),
                    lastActivityAt: now,
                    stalledAt: null,
                    cancelReason: null,
                });
            }

            this.ensureTransitionAllowed(
                canMoveToPending
                    ? DealEscrowStatus.FUNDS_PENDING
                    : deal.escrowStatus,
                DealEscrowStatus.FUNDS_CONFIRMED,
            );
            await dealRepository.update(deal.id, {
                escrowStatus: DealEscrowStatus.FUNDS_CONFIRMED,
                status: mapEscrowToDealStatus(
                    DealEscrowStatus.FUNDS_CONFIRMED,
                ),
                lastActivityAt: now,
                stalledAt: null,
                cancelReason: null,
            });

            const transactionRepository = manager.getRepository(TransactionEntity);

            const depositTransaction = transactionRepository.create({
                userId: deal.advertiserUserId,
                dealId: deal.id,
                escrowWalletId: wallet.id,
                type: TransactionType.DEPOSIT,
                direction: TransactionDirection.IN,
                status: TransactionStatus.CONFIRMED,
                amountNano: deal.escrowAmountNano,
                currency: 'TON',
                depositAddress: wallet.address,
                externalTxHash: externalTxHash ?? null,
                confirmedAt: now,
            });

            const holdTransaction = transactionRepository.create({
                userId: deal.advertiserUserId,
                dealId: deal.id,
                escrowWalletId: wallet.id,
                type: TransactionType.ESCROW_HOLD,
                direction: TransactionDirection.INTERNAL,
                status: TransactionStatus.COMPLETED,
                amountNano: deal.escrowAmountNano,
                currency: 'TON',
                completedAt: now,
            });

            await transactionRepository.save([
                depositTransaction,
                holdTransaction,
            ]);
        });

        return {
            dealId: deal.id,
            escrowStatus: DealEscrowStatus.FUNDS_CONFIRMED,
        };
    }


    private calculatePaymentExpiry(now: Date): Date {
        const timeoutMinutes = Number(
            this.configService.get<string>('DEAL_PAYMENT_TIMEOUT_MINUTES') ?? 60,
        );
        const expiresAt = new Date(now.getTime());
        expiresAt.setMinutes(expiresAt.getMinutes() + timeoutMinutes);
        return expiresAt;
    }

    private ensureTransitionAllowed(
        from: DealEscrowStatus,
        to: DealEscrowStatus,
    ) {
        try {
            assertTransitionAllowed(from, to);
        } catch (error) {
            if (error instanceof DealStateError) {
                throw new EscrowServiceError(
                    EscrowServiceErrorCode.INVALID_TRANSITION,
                );
            }
            throw error;
        }
    }
}
