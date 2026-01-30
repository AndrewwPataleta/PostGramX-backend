import {Injectable, Logger} from '@nestjs/common';
import {Cron} from '@nestjs/schedule';
import {randomUUID} from 'crypto';
import {DealsDeliveryService} from './deals-delivery.service';
import {DealDeliveryReconcilerService} from './deal-delivery-reconciler.service';
import {DEAL_DELIVERY_POSTING_CRON} from '../../config/deal-delivery.config';
import {logMeta} from '../../common/logging/logContext';
import {durationMs, nowMs} from '../../common/logging/time';

@Injectable()
export class DealsDeliveryCronService {
    private readonly logger = new Logger(DealsDeliveryCronService.name);

    constructor(
        private readonly dealsDeliveryService: DealsDeliveryService,
        private readonly reconcilerService: DealDeliveryReconcilerService,
    ) {}

    @Cron(DEAL_DELIVERY_POSTING_CRON)
    async handleDeliveryTick(): Promise<void> {
        const runId = randomUUID().split('-')[0];
        const startMs = nowMs();
        this.logger.log(
            'delivery.cron.start',
            logMeta({runId, now: new Date().toISOString()}),
        );
        try {
            const result = await this.dealsDeliveryService.processScheduledDeals(
                runId,
            );
            await this.reconcilerService.tick(runId);
            this.logger.log(
                'delivery.cron.finish',
                logMeta({
                    runId,
                    totalMs: durationMs(startMs),
                    processed: result.processed,
                    posted: result.posted,
                    skipped: result.skipped,
                    failed: result.failed,
                }),
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(
                'delivery.cron.fail',
                logMeta({runId, totalMs: durationMs(startMs), errorMessage: message}),
            );
            throw error;
        }
    }
}
