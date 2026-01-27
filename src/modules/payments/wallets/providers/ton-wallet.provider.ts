import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {createHash} from 'crypto';
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
    constructor(private readonly configService: ConfigService) {}

    async generateAddress(
        options: WalletGenerationOptions,
    ): Promise<GeneratedWallet> {
        const nodeEnv = this.configService.get<string>('NODE_ENV');

        if (nodeEnv === 'production') {
            throw new Error('TON wallet provider is not configured');
        }

        const seed = [options.scope, options.dealId ?? '', options.userId ?? '']
            .join(':')
            .toLowerCase();
        const hash = createHash('sha256').update(seed).digest('hex');
        const address = `EQDEV${hash.slice(0, 40)}`;

        return {
            address,
            metadata: {
                dev: true,
                seedHash: hash.slice(0, 16),
            },
        };
    }
}
