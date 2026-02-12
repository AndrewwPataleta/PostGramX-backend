export const CRON = {
    TON_INCOMING_WATCHER: '*/15 * * * * *',
    TON_OUTGOING_WATCHER: '*/20 * * * * *',
    TELEGRAM_ADMIN_SYNC: '*/10 * * * *',
} as const;

export const CRON_JOB_NAMES = {
    PAYOUT_EXECUTION: 'payout-execution',
} as const;
