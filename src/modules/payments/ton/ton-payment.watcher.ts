import { TonCenterClient } from "../ton/toncenter.client";

export class TonPaymentWatcher {
    constructor(
        private readonly ton: TonCenterClient,
        private readonly repo: {
            findAwaitingPayment(limit: number): Promise<Array<{
                dealId: string;
                payToAddress: string;
                expectedAmountNano: string;
                paymentExpiresAt: Date;
            }>>;
            markFundsDetected(dealId: string, data: { txHash: string; paidAt: Date }): Promise<void>;
            markPaymentExpired(now: Date): Promise<void>;
        },
    ) {}

    async tick() {
        const now = new Date();
        await this.repo.markPaymentExpired(now);

        const awaiting = await this.repo.findAwaitingPayment(200);

        for (const d of awaiting) {
            const txs = await this.ton.getTransactions(d.payToAddress, 10);

            const expected = BigInt(d.expectedAmountNano);

            const match = txs.find((t: any) => {
                const inMsg = t.in_msg;
                if (!inMsg?.value) return false;
                const value = BigInt(inMsg.value);
                const utimeMs = Number(t.utime) * 1000;
                return value >= expected && utimeMs <= d.paymentExpiresAt.getTime();
            });

            if (!match) continue;

            await this.repo.markFundsDetected(d.dealId, {
                txHash: match.transaction_id?.hash ?? match.hash,
                paidAt: new Date(Number(match.utime) * 1000),
            });
        }
    }
}
