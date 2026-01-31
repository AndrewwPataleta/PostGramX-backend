// ton-payment-watcher.ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";

import { DealEntity } from "../deals/entities/deal.entity";
import { DealEscrowStatus } from "../../common/constants/deals/deal-escrow-status.constants";
import { isTransitionAllowed } from "../deals/state/deal-state.machine";
import { mapEscrowToDealStatus } from "../deals/state/deal-status.mapper";
import { DealsNotificationsService } from "../deals/deals-notifications.service";
import { TonTransferEntity } from "./entities/ton-transfer.entity";
import { TransactionEntity } from "./entities/transaction.entity";
import { TransactionStatus } from "../../common/constants/payments/transaction-status.constants";
import { TransactionType } from "../../common/constants/payments/transaction-type.constants";
import { TonCenterClient } from "./ton/toncenter.client";
import { addNano, gteNano, subNano, formatTon } from "./utils/bigint";
import { CurrencyCode } from "../../common/constants/currency/currency.constants";

@Injectable()
export class TonPaymentWatcher {
    private readonly logger = new Logger(`${CurrencyCode.TON}-WATCHER`);

    constructor(
        private readonly ton: TonCenterClient,
        private readonly dataSource: DataSource,
        private readonly dealsNotificationsService: DealsNotificationsService,
        @InjectRepository(TransactionEntity)
        private readonly txRepo: Repository<TransactionEntity>
    ) {}

    @Cron("*/15 * * * * *")
    async monitorIncomingPayments() {
        try {
            const pending = await this.txRepo.find({
                where: {
                    status: In([TransactionStatus.PENDING, TransactionStatus.PARTIAL]),
                    type: TransactionType.ESCROW_HOLD,
                },
                take: 20,
            });

            if (!pending.length) return;

            for (const tx of pending) {
                if (!tx.depositAddress || !tx.dealId) continue;

                const transactions = await this.ton.getTransactions(tx.depositAddress, 10);

                for (const entry of transactions) {
                    const inMsg = (entry as any).in_msg;
                    if (!inMsg?.value) continue;

                    const amountNano = String(inMsg.value);

                    // normalize hash
                    const txHashRaw = (entry as any).transaction_id?.hash ?? (entry as any).hash;
                    if (!txHashRaw) continue;
                    const txHash = String(txHashRaw).toLowerCase();

                    const observedAt = new Date(Number((entry as any).utime) * 1000);

                    const result = await this.processTransfer(tx, {
                        txHash,
                        amountNano,
                        fromAddress: inMsg.source ?? "unknown",
                        observedAt,
                        raw: entry as any,
                    });

                    if (!result) continue;

                    if (result.type === "partial") {
                        await this.dealsNotificationsService.notifyAdvertiserPartialPayment(
                            result.deal,
                            result.receivedNano,
                            result.remainingNano
                        );
                    }

                    if (result.type === "confirmed") {
                        await this.dealsNotificationsService.notifyPaymentConfirmed(result.deal);
                    }
                }
            }
        } catch (err) {
            // ensure stack prints
            this.logger.error("Watcher error", err instanceof Error ? err.stack : String(err));
        }
    }

    private async processTransfer(
        tx: TransactionEntity,
        transfer: {
            txHash: string;
            amountNano: string;
            fromAddress: string;
            observedAt: Date;
            raw: Record<string, unknown>;
        }
    ): Promise<
        | {
        type: "partial";
        deal: DealEntity;
        receivedNano: string;
        remainingNano: string;
    }
        | {
        type: "confirmed";
        deal: DealEntity;
    }
        | null
    > {
        return this.dataSource.transaction(async (manager) => {
            const transferRepo = manager.getRepository(TonTransferEntity);
            const txRepo = manager.getRepository(TransactionEntity);
            const dealRepo = manager.getRepository(DealEntity);

            /**
             * 1) DEDUPE HARD:
             * Your @Index(unique) only works if it's actually in the DB.
             * Also don't rely on identifiers.length — it's flaky with DO NOTHING.
             */
            const insertResult = await transferRepo
                .createQueryBuilder()
                .insert()
                .values({
                    transactionId: tx.id,
                    dealId: tx.dealId,
                    depositAddress: tx.depositAddress as string,
                    fromAddress: transfer.fromAddress,
                    amountNano: transfer.amountNano,
                    txHash: transfer.txHash, // already normalized
                    observedAt: transfer.observedAt,
                    raw: transfer.raw,
                })
                // Explicit conflict target: requires unique constraint/index in DB
                .onConflict(`("txHash") DO NOTHING`)
                .execute();

            // TypeORM/Postgres may not fill identifiers. affected is the reliable indicator here.
            const inserted = (insertResult as any).affected ? (insertResult as any).affected > 0 : false;

            if (!inserted) {
                // duplicate transfer => do nothing
                return null;
            }

            // 2) Lock tx row and update received/status
            const lockedTx = await txRepo.findOne({
                where: { id: tx.id },
                lock: { mode: "pessimistic_write" },
            });

            if (!lockedTx) return null;

            const currentReceived = lockedTx.receivedNano ?? "0";
            const nextReceived = addNano(currentReceived, transfer.amountNano);
            const expected = lockedTx.amountNano;

            const isConfirmed = gteNano(nextReceived, expected);
            const remaining = isConfirmed ? "0" : subNano(expected, nextReceived);

            const metadata = (lockedTx.metadata ?? {}) as Record<string, any>;
            const paymentMetadata = (metadata.payment ?? {}) as Record<string, any>;
            const lastNotified = paymentMetadata.lastNotifiedReceivedNano ?? null;

            const shouldNotifyPartial = !isConfirmed && lastNotified !== nextReceived;

            const updatePayload: Partial<TransactionEntity> = {
                receivedNano: nextReceived,
                status: isConfirmed ? TransactionStatus.CONFIRMED : TransactionStatus.PARTIAL,
            };

            if (isConfirmed) {
                updatePayload.confirmedAt = lockedTx.confirmedAt ?? new Date();
                updatePayload.externalTxHash = transfer.txHash;
            }

            if (shouldNotifyPartial) {
                updatePayload.metadata = {
                    ...metadata,
                    payment: {
                        ...paymentMetadata,
                        lastNotifiedReceivedNano: nextReceived,
                    },
                };
            }

            const upd = await txRepo.update(lockedTx.id, updatePayload);

            // DEBUG: if status isn't changing, you will see it here immediately
            this.logger.warn(
                `[TX UPDATE] id=${lockedTx.id} affected=${upd.affected ?? "?"} status->${updatePayload.status} received->${nextReceived}`
            );

            // If update didn't touch row => something is off
            if (!upd.affected) {
                return null;
            }

            // 3) Deal processing
            if (!lockedTx.dealId) return null;

            const deal = await dealRepo.findOne({
                where: { id: lockedTx.dealId },
                lock: { mode: "pessimistic_write" },
            });

            if (!deal) return null;

            if (isConfirmed) {
                if (
                    deal.escrowStatus !== DealEscrowStatus.FUNDS_CONFIRMED &&
                    isTransitionAllowed(deal.escrowStatus, DealEscrowStatus.FUNDS_CONFIRMED)
                ) {
                    await dealRepo.update(deal.id, {
                        escrowStatus: DealEscrowStatus.FUNDS_CONFIRMED,
                        status: mapEscrowToDealStatus(DealEscrowStatus.FUNDS_CONFIRMED),
                    });
                }

                this.logger.warn("✅ PAYMENT CONFIRMED");
                this.logger.warn(`TX ID: ${tx.id}`);
                this.logger.warn(`Address: ${tx.depositAddress}`);
                this.logger.warn(`Amount: ${formatTon(nextReceived)} ${CurrencyCode.TON}`);
                this.logger.warn(`Hash: ${transfer.txHash}`);

                return { type: "confirmed", deal };
            }

            if (
                deal.escrowStatus === DealEscrowStatus.AWAITING_PAYMENT &&
                isTransitionAllowed(deal.escrowStatus, DealEscrowStatus.FUNDS_PENDING)
            ) {
                await dealRepo.update(deal.id, {
                    escrowStatus: DealEscrowStatus.FUNDS_PENDING,
                    status: mapEscrowToDealStatus(DealEscrowStatus.FUNDS_PENDING),
                });
            }

            if (shouldNotifyPartial) {
                this.logger.warn("💰 PARTIAL PAYMENT RECEIVED");
                this.logger.warn(`TX ID: ${tx.id}`);
                this.logger.warn(`Address: ${tx.depositAddress}`);
                this.logger.warn(`Received: ${formatTon(nextReceived)} ${CurrencyCode.TON}`);
                this.logger.warn(`Remaining: ${formatTon(remaining)} ${CurrencyCode.TON}`);
                this.logger.warn(`Hash: ${transfer.txHash}`);

                return {
                    type: "partial",
                    deal,
                    receivedNano: nextReceived,
                    remainingNano: remaining,
                };
            }

            return null;
        });
    }
}
