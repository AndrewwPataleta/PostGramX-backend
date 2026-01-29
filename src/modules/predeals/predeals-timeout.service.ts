import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Cron, CronExpression} from '@nestjs/schedule';
import {InjectRepository} from '@nestjs/typeorm';
import {In, LessThan, Repository} from 'typeorm';
import {PreDealEntity} from './entities/pre-deal.entity';
import {PreDealStatus} from './types/predeal-status.enum';
import {PreDealsService} from './predeals.service';

@Injectable()
export class PreDealsTimeoutService {
    private readonly logger = new Logger(PreDealsTimeoutService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly preDealsService: PreDealsService,
        @InjectRepository(PreDealEntity)
        private readonly preDealRepository: Repository<PreDealEntity>,
    ) {}

    @Cron(process.env.PREDEAL_SWEEP_CRON ?? CronExpression.EVERY_MINUTE)
    async handlePreDealTimeouts() {
        await this.handleStalledPreDeals();
        await this.handlePaymentWindows();
    }

    private async handleStalledPreDeals() {
        const now = new Date();
        const stallHours = Number(
            this.configService.get<string>('PREDEAL_STALL_TIMEOUT_HOURS') ?? 24,
        );
        const threshold = new Date(now.getTime());
        threshold.setHours(threshold.getHours() - stallHours);

        const stalledStatuses = [
            PreDealStatus.AWAITING_CREATIVE,
            PreDealStatus.AWAITING_ADVERTISER_CONFIRMATION,
            PreDealStatus.AWAITING_PUBLISHER_APPROVAL,
            PreDealStatus.AWAITING_PAYMENT_WINDOW,
        ];
        const stalled = await this.preDealRepository.find({
            where: {
                status: In(stalledStatuses),
                lastActivityAt: LessThan(threshold),
            },
        });

        for (const preDeal of stalled) {
            await this.preDealsService.notifyExpired(
                preDeal,
                'inactivity timeout',
            );
        }

        if (stalled.length > 0) {
            this.logger.log(`Expired ${stalled.length} stalled pre-deals`);
        }
    }

    private async handlePaymentWindows() {
        const now = new Date();
        const expiredPayments = await this.preDealRepository.find({
            where: {
                status: PreDealStatus.READY_FOR_PAYMENT,
                paymentExpiresAt: LessThan(now),
            },
        });

        for (const preDeal of expiredPayments) {
            await this.preDealsService.notifyExpired(
                preDeal,
                'payment window expired',
            );
        }

        if (expiredPayments.length > 0) {
            this.logger.log(
                `Expired ${expiredPayments.length} pre-deals due to payment windows`,
            );
        }
    }
}
