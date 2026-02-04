import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

export type FeeMode = 'FIXED' | 'BPS';
export type NetworkFeeMode = 'FIXED' | 'ESTIMATE';
export type FeeRevenueStrategy = 'LEDGER_ONLY' | 'LEDGER_AND_TRANSFER';

export type FeesConfig = {
    feesEnabled: boolean;
    payoutServiceFeeMode: FeeMode;
    payoutServiceFeeFixedNano: string;
    payoutServiceFeeBps: string;
    payoutServiceFeeMinNano: string;
    payoutServiceFeeMaxNano?: string;
    payoutNetworkFeeMode: NetworkFeeMode;
    payoutNetworkFeeFixedNano: string;
    payoutNetworkFeeMinNano: string;
    payoutNetworkFeeMaxNano?: string;
    payoutMinNetAmountNano?: string;
    feeRevenueStrategy: FeeRevenueStrategy;
    feeRevenueAddress?: string;
};

@Injectable()
export class FeesConfigService {
    private readonly config: FeesConfig;

    constructor(private readonly configService: ConfigService) {
        this.config = {
            feesEnabled: this.readBoolean('FEES_ENABLED', true),
            payoutServiceFeeMode: this.readEnum<FeeMode>(
                'PAYOUT_SERVICE_FEE_MODE',
                ['FIXED', 'BPS'],
                'BPS',
            ),
            payoutServiceFeeFixedNano: this.readNano(
                'PAYOUT_SERVICE_FEE_FIXED_NANO',
                '0',
            ),
            payoutServiceFeeBps: this.readNano('PAYOUT_SERVICE_FEE_BPS', '50'),
            payoutServiceFeeMinNano: this.readNano(
                'PAYOUT_SERVICE_FEE_MIN_NANO',
                '0',
            ),
            payoutServiceFeeMaxNano: this.readOptionalNano(
                'PAYOUT_SERVICE_FEE_MAX_NANO',
            ),
            payoutNetworkFeeMode: this.readEnum<NetworkFeeMode>(
                'PAYOUT_NETWORK_FEE_MODE',
                ['FIXED', 'ESTIMATE'],
                'FIXED',
            ),
            payoutNetworkFeeFixedNano: this.readNano(
                'PAYOUT_NETWORK_FEE_FIXED_NANO',
                '5000000',
            ),
            payoutNetworkFeeMinNano: this.readNano(
                'PAYOUT_NETWORK_FEE_MIN_NANO',
                '0',
            ),
            payoutNetworkFeeMaxNano: this.readOptionalNano(
                'PAYOUT_NETWORK_FEE_MAX_NANO',
            ),
            payoutMinNetAmountNano: this.readOptionalNano(
                'PAYOUT_MIN_NET_AMOUNT_NANO',
            ),
            feeRevenueStrategy: this.readEnum<FeeRevenueStrategy>(
                'FEE_REVENUE_STRATEGY',
                ['LEDGER_ONLY', 'LEDGER_AND_TRANSFER'],
                'LEDGER_ONLY',
            ),
            feeRevenueAddress: this.readOptionalString('FEE_REVENUE_ADDRESS'),
        };
    }

    getConfig(): FeesConfig {
        return this.config;
    }

    private readBoolean(key: string, fallback: boolean): boolean {
        const value = this.configService.get<string>(key);
        if (value === undefined) {
            return fallback;
        }
        return value.toLowerCase() === 'true';
    }

    private readEnum<T extends string>(
        key: string,
        allowed: T[],
        fallback: T,
    ): T {
        const value = this.configService.get<string>(key);
        if (!value) {
            return fallback;
        }
        return allowed.includes(value as T) ? (value as T) : fallback;
    }

    private readNano(key: string, fallback: string): string {
        const value = this.configService.get<string>(key);
        if (!value) {
            return fallback;
        }
        if (!/^\d+$/.test(value)) {
            throw new Error(`${key} must be a numeric string`);
        }
        return value;
    }

    private readOptionalNano(key: string): string | undefined {
        const value = this.configService.get<string>(key);
        if (!value) {
            return undefined;
        }
        if (!/^\d+$/.test(value)) {
            throw new Error(`${key} must be a numeric string`);
        }
        return value;
    }

    private readOptionalString(key: string): string | undefined {
        const value = this.configService.get<string>(key);
        if (!value) {
            return undefined;
        }
        return value;
    }
}
