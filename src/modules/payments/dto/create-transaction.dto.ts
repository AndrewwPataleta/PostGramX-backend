import {TransactionDirection} from '../types/transaction-direction.enum';
import {TransactionStatus} from '../types/transaction-status.enum';
import {TransactionType} from '../types/transaction-type.enum';

export class CreateTransactionDto {
    userId: string;
    type: TransactionType;
    direction: TransactionDirection;
    status?: TransactionStatus;
    amountNano: string;
    currency?: string;
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
