import {Injectable, Logger} from '@nestjs/common';

@Injectable()
export class DealDeliveryReconcilerService {
    private readonly logger = new Logger(DealDeliveryReconcilerService.name);

    async tick(): Promise<void> {
        this.logger.debug(
            'Delivery reconciler tick (TODO: verify published posts remain live).',
        );
    }
}
