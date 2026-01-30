import {Injectable, Logger} from '@nestjs/common';
import {Cron} from '@nestjs/schedule';
import {DealsDeliveryService} from './deals-delivery.service';
import {DealDeliveryReconcilerService} from './deal-delivery-reconciler.service';
import {DEAL_DELIVERY_POSTING_CRON} from '../../config/deal-delivery.config';

@Injectable()
export class DealsDeliveryCronService {
    private readonly logger = new Logger(DealsDeliveryCronService.name);

    constructor(
        private readonly dealsDeliveryService: DealsDeliveryService,
        private readonly reconcilerService: DealDeliveryReconcilerService,
    ) {}

    @Cron(DEAL_DELIVERY_POSTING_CRON)
    async handleDeliveryTick(): Promise<void> {
        this.logger.log('DeliveryCron tick');
        await this.dealsDeliveryService.processScheduledDeals();
        await this.reconcilerService.tick();
    }
}
