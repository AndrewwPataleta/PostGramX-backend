import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Address, internal, TonClient, WalletContractV4} from '@ton/ton';
import {mnemonicToPrivateKey} from '@ton/crypto';
import {TonCenterClient} from './toncenter.client';

@Injectable()
export class TonHotWalletService {
    private readonly client: TonClient;
    private readonly mnemonic: string[];
    private readonly toncenter: TonCenterClient;

    constructor(private readonly configService: ConfigService) {
        const endpoint = this.configService.get<string>('TONCENTER_RPC');
        const apiKey = this.configService.get<string>('TONCENTER_API_KEY');
        if (!endpoint) {
            throw new Error('TONCENTER_RPC is not configured');
        }
        this.client = new TonClient({endpoint, apiKey});
        this.toncenter = new TonCenterClient({
            endpoint,
            apiKey: apiKey ?? '',
        });

        const mnemonic = this.configService.get<string>('HOT_WALLET_MNEMONIC');
        if (!mnemonic) {
            throw new Error('HOT_WALLET_MNEMONIC is not configured');
        }
        this.mnemonic = mnemonic.split(/[\s,]+/).filter(Boolean);
    }

    validateDestinationAddress(destination: string): void {
        Address.parse(destination);
    }

    async getAddress(): Promise<string> {
        const keyPair = await mnemonicToPrivateKey(this.mnemonic);
        const contract = this.client.open(
            WalletContractV4.create({
                workchain: 0,
                publicKey: keyPair.publicKey,
            }),
        );
        return contract.address.toString();
    }

    async getBalance(): Promise<bigint> {
        const address = Address.parse(await this.getAddress());
        const state = await this.client.getContractState(address);
        return BigInt(state.balance ?? 0);
    }

    async sendTon(options: {
        toAddress: string;
        amountNano: bigint;
    }): Promise<{txHash: string | null}> {
        const keyPair = await mnemonicToPrivateKey(this.mnemonic);
        const contract = this.client.open(
            WalletContractV4.create({
                workchain: 0,
                publicKey: keyPair.publicKey,
            }),
        );

        const seqno = await contract.getSeqno();
        const transfer = contract.createTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            messages: [
                internal({
                    to: Address.parse(options.toAddress),
                    value: options.amountNano,
                    bounce: false,
                }),
            ],
        });
        const messageHash = transfer.hash().toString('hex').toLowerCase();
        await this.client.sendExternalMessage(contract, transfer);

        const txHash = await this.waitForTransactionHash(
            contract.address.toString(),
            messageHash,
        );

        return {txHash};
    }

    private async waitForTransactionHash(
        address: string,
        messageHash: string,
    ): Promise<string | null> {
        const attempts = 10;
        const delayMs = 1500;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            const transactions = await this.toncenter.getTransactions(address, 20);
            for (const entry of transactions ?? []) {
                const inMsg = (entry as any)?.in_msg;
                const inMsgHash =
                    inMsg?.hash ??
                    inMsg?.message_hash ??
                    inMsg?.msg_hash ??
                    null;
                if (!inMsgHash) {
                    continue;
                }
                if (String(inMsgHash).toLowerCase() !== messageHash) {
                    continue;
                }
                const txHash =
                    (entry as any)?.transaction_id?.hash ?? (entry as any)?.hash;
                return txHash ? String(txHash).toLowerCase() : null;
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        throw new Error('Unable to resolve transaction hash after broadcast');
    }
}
