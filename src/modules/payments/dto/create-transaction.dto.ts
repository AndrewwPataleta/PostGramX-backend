export class CreateTransactionDto {
    userId: string;
    amountNano: string;
    currency?: string;
    description?: string | null;
    dealId?: string | null;
    channelId?: string | null;
    counterpartyUserId?: string | null;
    metadata?: Record<string, unknown> | null;
}
