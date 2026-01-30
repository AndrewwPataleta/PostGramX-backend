const parseNumber = (value: string | undefined, fallback: number): number => {
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
};

export const DEALS_CONFIG = {
    MAX_ACTIVE_PREDEALS_PER_LISTING_PER_USER: parseNumber(
        process.env.MAX_ACTIVE_PREDEALS_PER_LISTING_PER_USER,
        1,
    ),
    PREDEAL_IDLE_EXPIRE_MINUTES: parseNumber(
        process.env.PREDEAL_IDLE_EXPIRE_MINUTES,
        45,
    ),
    CREATIVE_SUBMIT_DEADLINE_MINUTES: parseNumber(
        process.env.CREATIVE_SUBMIT_DEADLINE_MINUTES,
        30,
    ),
    ADMIN_RESPONSE_DEADLINE_HOURS: parseNumber(
        process.env.ADMIN_RESPONSE_DEADLINE_HOURS,
        24,
    ),
    REMINDER_BEFORE_EXPIRE_MINUTES: parseNumber(
        process.env.REMINDER_BEFORE_EXPIRE_MINUTES,
        10,
    ),
    REMINDER_BEFORE_ADMIN_DEADLINE_MINUTES: parseNumber(
        process.env.REMINDER_BEFORE_ADMIN_DEADLINE_MINUTES,
        60,
    ),
    REMINDER_BEFORE_PAYMENT_DEADLINE_MINUTES: parseNumber(
        process.env.REMINDER_BEFORE_PAYMENT_DEADLINE_MINUTES,
        10,
    ),
    PAYMENT_WINDOW_MINUTES: parseNumber(
        process.env.PAYMENT_WINDOW_MINUTES,
        60,
    ),
    CRON_INTERVAL_MINUTES: parseNumber(
        process.env.DEAL_TIMEOUTS_CRON_INTERVAL_MINUTES,
        1,
    ),
};

export const DEAL_TIMEOUTS_CRON = `*/${DEALS_CONFIG.CRON_INTERVAL_MINUTES} * * * *`;
