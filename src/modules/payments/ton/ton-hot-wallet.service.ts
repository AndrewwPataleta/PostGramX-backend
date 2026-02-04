import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Address, internal, TonClient, WalletContractV4} from '@ton/ton';
import {mnemonicToPrivateKey} from '@ton/crypto';

@Injectable()
export class TonHotWalletService {
    private readonly client: TonClient;
    private readonly mnemonic: string[];

    constructor(private readonly configService: ConfigService) {
        const endpoint = this.configService.get<string>('TONCENTER_RPC');
        const apiKey = this.configService.get<string>('TONCENTER_API_KEY');
        if (!endpoint) {
            throw new Error('TONCENTER_RPC is not configured');
        }
        this.client = new TonClient({endpoint, apiKey});

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
        await contract.sendTransfer({
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

        return {txHash: null};
    }
}
