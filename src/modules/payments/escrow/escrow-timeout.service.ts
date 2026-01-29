import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Cron, CronExpression} from '@nestjs/schedule';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, In, LessThan, Repository} from 'typeorm';
import {DealEntity} from '../../deals/entities/deal.entity';
import {DealEscrowStatus} from '../../deals/types/deal-escrow-status.enum';
import {WalletsService} from '../wallets/wallets.service';
import {mapEscrowToDealStatus} from '../../deals/state/deal-status.mapper';
import {assertTransitionAllowed} from '../../deals/state/deal-state.machine';

@Injectable()
export class EscrowTimeoutService {
    private readonly logger = new Logger(EscrowTimeoutService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly configService: ConfigService,
        private readonly walletsService: WalletsService,
        @InjectRepository(DealEntity)
        private readonly dealRepository: Repository<DealEntity>,
    ) {}

    @Cron(process.env.DEAL_ESCROW_SWEEP_CRON ?? CronExpression.EVERY_5_MINUTES)
    async handleEscrowTimeouts() {
        await this.handlePaymentTimeouts();
        await this.handleStallTimeouts();
    }

    private async handlePaymentTimeouts() {
        const now = new Date();
        const expiredDeals = await this.dealRepository.find({
            where: {
                escrowStatus: DealEscrowStatus.PAYMENT_AWAITING,
                escrowExpiresAt: LessThan(now),
            },
        });

        if (expiredDeals.length === 0) {
            return;
        }

        for (const deal of expiredDeals) {
            await this.dataSource.transaction(async (manager) => {
                assertTransitionAllowed(
                    deal.escrowStatus,
                    DealEscrowStatus.CANCELED,
                );
                await manager.getRepository(DealEntity).update(deal.id, {
                    escrowStatus: DealEscrowStatus.CANCELED,
                    status: mapEscrowToDealStatus(DealEscrowStatus.CANCELED),
                    cancelReason: 'PAYMENT_TIMEOUT',
                    lastActivityAt: now,
                    stalledAt: now,
                });

                if (deal.escrowWalletId) {
                    await this.walletsService.closeWallet(
                        deal.escrowWalletId,
                        manager,
                    );
                }
            });
        }

        this.logger.log(`Auto-canceled ${expiredDeals.length} deals`);
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
            DealEscrowStatus.SCHEDULING_PENDING,
            DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
            DealEscrowStatus.CREATIVE_AWAITING_CONFIRM,
            DealEscrowStatus.ADMIN_REVIEW,
            DealEscrowStatus.PAYMENT_WINDOW_PENDING,
            DealEscrowStatus.PAYMENT_AWAITING,
            DealEscrowStatus.FUNDS_PENDING,
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

                if (deal.escrowWalletId) {
                    await this.walletsService.closeWallet(
                        deal.escrowWalletId,
                        manager,
                    );
                }
            });
        }

        const postFundingStatuses = [
            DealEscrowStatus.CREATIVE_PENDING,
            DealEscrowStatus.CREATIVE_REVIEW,
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
