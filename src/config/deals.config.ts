import {Logger} from '@nestjs/common';
import {DEAL_TIMEOUTS} from '../common/constants/deals/deal-timeouts.constants';

const logger = new Logger('DealsConfig');

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

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
    if (value === undefined) {
        return fallback;
    }
    return value === 'true';
};

export const DEALS_CONFIG = {
    MAX_ACTIVE_PENDING_DEALS_PER_LISTING_PER_USER: parseNumber(
        process.env.MAX_ACTIVE_PENDING_DEALS_PER_LISTING_PER_USER,
        2,
    ),
    DEAL_IDLE_EXPIRE_MINUTES: parseNumber(
        process.env.DEAL_IDLE_EXPIRE_MINUTES,
        DEAL_TIMEOUTS.PRE_DEAL_EXPIRE_MINUTES,
    ),
    CREATIVE_SUBMIT_DEADLINE_MINUTES: parseNumber(
        process.env.CREATIVE_SUBMIT_DEADLINE_MINUTES,
        DEAL_TIMEOUTS.CREATIVE_SUBMIT_MINUTES,
    ),
    ADMIN_RESPONSE_DEADLINE_HOURS: parseNumber(
        process.env.ADMIN_RESPONSE_DEADLINE_HOURS,
        DEAL_TIMEOUTS.ADMIN_REVIEW_HOURS,
    ),
    PAYMENT_DEADLINE_MINUTES: parseNumber(
        process.env.DEAL_PAYMENT_TIMEOUT_MINUTES,
        DEAL_TIMEOUTS.PAYMENT_WINDOW_MINUTES,
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
    CRON_INTERVAL_MINUTES: parseNumber(
        process.env.DEAL_TIMEOUTS_CRON_INTERVAL_MINUTES,
        1,
    ),
    AUTO_ADMIN_IMPPROVE: parseBoolean(
        process.env.auto_admin_impprove,
        false,
    ),
    MOCK_CREATIVE_APPROVE:
        process.env.DEALS_MOCK_CREATIVE_APPROVE === 'true',
};

if (process.env.NODE_ENV === 'production' && DEALS_CONFIG.MOCK_CREATIVE_APPROVE) {
    logger.error(
        'MOCK_CREATIVE_APPROVE cannot be enabled in production. Forcing OFF.',
    );
    DEALS_CONFIG.MOCK_CREATIVE_APPROVE = false;
}

logger.log(
    `Deals mock creative approve: ${
        DEALS_CONFIG.MOCK_CREATIVE_APPROVE ? 'enabled' : 'disabled'
    }`,
);

export const DEAL_TIMEOUTS_CRON = `*/${DEALS_CONFIG.CRON_INTERVAL_MINUTES} * * * *`;
