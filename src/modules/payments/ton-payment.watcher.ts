import {Injectable, Logger} from "@nestjs/common";
import {Cron} from "@nestjs/schedule";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {TransactionEntity} from "./entities/transaction.entity";
import {TransactionStatus} from "./types/transaction-status.enum";
import {TransactionType} from "./types/transaction-type.enum";
import {TonCenterClient} from "./ton/toncenter.client";

@Injectable()
export class TonPaymentWatcher {
    private readonly logger = new Logger("TON-WATCHER");


    constructor(
        private readonly ton: TonCenterClient,
        @InjectRepository(TransactionEntity)
        private readonly txRepo: Repository<TransactionEntity>,
    ) {
    }

    // Каждые 15 секунд
    @Cron("*/15 * * * * *")
    async monitorIncomingPayments() {
        try {
            const pending = await this.txRepo.find({
                where: {
                    status: TransactionStatus.PENDING,
                    type: TransactionType.ESCROW_HOLD,
                },
                take: 20,
            });

            if (!pending.length) {
                return;
            }

            this.logger.log(`Checking ${pending.length} escrow wallets...`);

            for (const tx of pending) {
                if (!tx.depositAddress) continue;

                const transactions = await this.ton.getTransactions(tx.depositAddress, 5);

                const incoming = transactions.find((t: any) => {
                    const inMsg = t.in_msg;
                    if (!inMsg?.value) return false;

                    const received = BigInt(inMsg.value);
                    const expected = BigInt(tx.amountNano);

                    return received >= expected;
                });

                if (!incoming) continue;

                const hash = incoming.transaction_id?.hash ?? incoming.hash;
                const receivedNano = incoming.in_msg.value;

                this.logger.warn("💰 PAYMENT RECEIVED");
                this.logger.warn(`TX ID: ${tx.id}`);
                this.logger.warn(`Address: ${tx.depositAddress}`);
                this.logger.warn(`Amount: ${Number(receivedNano) / 1e9} TON`);
                this.logger.warn(`Hash: ${hash}`);

                // Пока только логируем.
                // Следующим шагом:
                await this.txRepo.update(tx.id, {
                  status: TransactionStatus.CONFIRMED,
                  externalTxHash: hash,
                  confirmedAt: new Date(),
                });

            }
        } catch (err) {
            this.logger.error("Watcher error", err);
        }
    }
}
