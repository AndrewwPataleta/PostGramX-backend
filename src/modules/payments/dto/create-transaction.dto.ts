import {TransactionDirection} from '../../../common/constants/payments/transaction-direction.constants';
import {TransactionStatus} from '../../../common/constants/payments/transaction-status.constants';
import {TransactionType} from '../../../common/constants/payments/transaction-type.constants';
import {CurrencyCode} from '../../../common/constants/currency/currency.constants';

export class CreateTransactionDto {
    userId: string;
    type: TransactionType;
    direction: TransactionDirection;
    status?: TransactionStatus;
    amountNano: string;
    currency?: CurrencyCode;
    description?: string | null;
    dealId?: string | null;
    escrowWalletId?: string | null;
    channelId?: string | null;
    counterpartyUserId?: string | null;
    depositAddress?: string | null;
    externalTxHash?: string | null;
    externalExplorerUrl?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown> | null;
    confirmedAt?: Date | null;
    completedAt?: Date | null;
}
