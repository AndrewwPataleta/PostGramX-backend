import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Cron, CronExpression} from '@nestjs/schedule';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, In, LessThan, Repository} from 'typeorm';
import {DealEntity} from '../../deals/entities/deal.entity';
import {DealEscrowStatus} from '../../deals/types/deal-escrow-status.enum';
import {mapEscrowToDealStatus} from '../../deals/state/deal-status.mapper';
import {assertTransitionAllowed} from '../../deals/state/deal-state.machine';

@Injectable()
export class EscrowTimeoutService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly configService: ConfigService,
        @InjectRepository(DealEntity)
        private readonly dealRepository: Repository<DealEntity>,
    ) {}

    @Cron(process.env.DEAL_ESCROW_SWEEP_CRON ?? CronExpression.EVERY_5_MINUTES)
    async handleEscrowTimeouts() {
        await this.handleStallTimeouts();
    }

    private async handleStallTimeouts() {
        const now = new Date();
        const stallHours = Number(
            this.configService.get<string>('DEAL_STALL_TIMEOUT_HOURS') ?? 72,
        );
        const threshold = new Date(now.getTime());
        threshold.setHours(threshold.getHours() - stallHours);

        const preFundingStatuses = [
            DealEscrowStatus.DRAFT,
            DealEscrowStatus.WAITING_SCHEDULE,
            DealEscrowStatus.WAITING_CREATIVE,
            DealEscrowStatus.CREATIVE_SUBMITTED,
            DealEscrowStatus.ADMIN_REVIEW,
            DealEscrowStatus.CHANGES_REQUESTED,
            DealEscrowStatus.AWAITING_PAYMENT,
            DealEscrowStatus.PAYMENT_PENDING,
        ];

        const stalledBeforeFunding = await this.dealRepository.find({
            where: {
                escrowStatus: In(preFundingStatuses),
                lastActivityAt: LessThan(threshold),
            },
        });

        for (const deal of stalledBeforeFunding) {
            await this.dataSource.transaction(async (manager) => {
                assertTransitionAllowed(
                    deal.escrowStatus,
                    DealEscrowStatus.CANCELED,
                );
                await manager.getRepository(DealEntity).update(deal.id, {
                    escrowStatus: DealEscrowStatus.CANCELED,
                    status: mapEscrowToDealStatus(DealEscrowStatus.CANCELED),
                    cancelReason: 'STALL_TIMEOUT',
                    lastActivityAt: now,
                    stalledAt: now,
                });

            });
        }

        const postFundingStatuses = [
            DealEscrowStatus.SCHEDULED,
            DealEscrowStatus.POSTING,
            DealEscrowStatus.POSTED_VERIFYING,
        ];

        const stalledAfterFunding = await this.dealRepository.find({
            where: {
                escrowStatus: In(postFundingStatuses),
                lastActivityAt: LessThan(threshold),
            },
        });

        for (const deal of stalledAfterFunding) {
            await this.dataSource.transaction(async (manager) => {
                assertTransitionAllowed(
                    deal.escrowStatus,
                    DealEscrowStatus.DISPUTED,
                );
                await manager.getRepository(DealEntity).update(deal.id, {
                    escrowStatus: DealEscrowStatus.DISPUTED,
                    status: mapEscrowToDealStatus(DealEscrowStatus.DISPUTED),
                    cancelReason: 'STALL_TIMEOUT',
                    lastActivityAt: now,
                    stalledAt: now,
                });
            });
        }
    }
}
