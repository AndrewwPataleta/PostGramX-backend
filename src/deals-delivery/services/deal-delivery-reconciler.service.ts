import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {DealEntity} from '../../modules/deals/entities/deal.entity';
import {DealEscrowStatus} from '../../modules/deals/types/deal-escrow-status.enum';
import {logMeta} from '../../common/logging/logContext';
import {durationMs, nowMs} from '../../common/logging/time';

@Injectable()
export class DealDeliveryReconcilerService {
    private readonly logger = new Logger(DealDeliveryReconcilerService.name);

    constructor(
        @InjectRepository(DealEntity)
        private readonly dealRepository: Repository<DealEntity>,
    ) {}

    async tick(runId: string): Promise<void> {
        const startMs = nowMs();
        this.logger.log(
            'delivery.verify.start',
            logMeta({runId, now: new Date().toISOString()}),
        );
        const selectStartMs = nowMs();
        const deals = await this.dealRepository.find({
            where: {escrowStatus: DealEscrowStatus.POSTED_VERIFYING},
            order: {publishedAt: 'ASC'},
            take: 20,
        });
        this.logger.log(
            'delivery.verify.selected',
            logMeta({
                runId,
                count: deals.length,
                selectMs: durationMs(selectStartMs),
                dealIds: deals.slice(0, 50).map((deal) => deal.id),
            }),
        );

        for (const deal of deals) {
            const traceId = `${runId}-${deal.id.slice(0, 8)}`;
            const checkStartMs = nowMs();
            this.logger.log(
                'delivery.verify.check.start',
                logMeta({
                    runId,
                    traceId,
                    dealId: deal.id,
                    messageId: deal.publishedMessageId ?? null,
                }),
            );
            this.logger.warn(
                'delivery.verify.skip',
                logMeta({
                    runId,
                    traceId,
                    dealId: deal.id,
                    reason: 'verification_not_implemented',
                    ms: durationMs(checkStartMs),
                }),
            );
        }

        this.logger.log(
            'delivery.verify.finish',
            logMeta({runId, totalMs: durationMs(startMs)}),
        );
    }
}
