import {Injectable} from '@nestjs/common';
import {DealWalletFactory} from '../../ton/wallet.factory';
import {WalletScope} from '../types/wallet-scope.enum';

export type WalletGenerationOptions = {
    scope: WalletScope;
    dealId?: string;
    userId?: string;
};

export type GeneratedWallet = {
    address: string;
    metadata?: Record<string, unknown>;
    secret?: string;
};

@Injectable()
export class TonWalletProvider {
    constructor(private readonly dealWalletFactory: DealWalletFactory) {}

    async generateAddress(
        options: WalletGenerationOptions,
    ): Promise<GeneratedWallet> {
        const wallet = await this.dealWalletFactory.createNewDealWallet();

        return {
            address: wallet.address,
            secret: JSON.stringify({
                scope: options.scope,
                dealId: options.dealId,
                userId: options.userId,
                mnemonic: wallet.mnemonic,
                publicKeyHex: wallet.publicKeyHex,
                secretKeyHex: wallet.secretKeyHex,
                address: wallet.address,
            }),
            metadata: {
                publicKeyHex: wallet.publicKeyHex,
            },
        };
    }
}
