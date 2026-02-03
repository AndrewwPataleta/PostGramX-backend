import {Injectable, Logger} from '@nestjs/common';
import {Cron} from '@nestjs/schedule';
import {InjectRepository} from '@nestjs/typeorm';
import {LessThanOrEqual, Repository} from 'typeorm';
import {DealEntity} from '../../deals/entities/deal.entity';
import {DealCreativeEntity} from '../../deals/entities/deal-creative.entity';
import {DealEscrowEntity} from '../../deals/entities/deal-escrow.entity';
import {DealPublicationEntity} from '../../deals/entities/deal-publication.entity';
import {ChannelEntity} from '../../channels/entities/channel.entity';
import {DealStage} from '../../../common/constants/deals/deal-stage.constants';
import {DealStatus} from '../../../common/constants/deals/deal-status.constants';
import {EscrowStatus} from '../../../common/constants/deals/deal-escrow-status.constants';
import {CreativeStatus} from '../../../common/constants/deals/creative-status.constants';
import {PublicationStatus} from '../../../common/constants/deals/publication-status.constants';
import {TelegramPosterService} from './telegram-poster.service';
import {PaymentsService} from '../../payments/payments.service';
import {DealsNotificationsService} from '../../deals/deals-notifications.service';

const POST_VERIFICATION_CRON =
    process.env.NODE_ENV === 'production' ? '0 */30 * * * *' : '0 * * * * *';

@Injectable()
export class DealPostingWorker {
    private readonly logger = new Logger(DealPostingWorker.name);

    constructor(
        @InjectRepository(DealEntity)
        private readonly dealRepository: Repository<DealEntity>,
        @InjectRepository(DealEscrowEntity)
        private readonly escrowRepository: Repository<DealEscrowEntity>,
        @InjectRepository(DealCreativeEntity)
        private readonly creativeRepository: Repository<DealCreativeEntity>,
        @InjectRepository(DealPublicationEntity)
        private readonly publicationRepository: Repository<DealPublicationEntity>,
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        private readonly telegramPosterService: TelegramPosterService,
        private readonly paymentsService: PaymentsService,
        private readonly dealsNotificationsService: DealsNotificationsService,
    ) {}

    @Cron('*/30 * * * * *')
    async handlePostingCron(): Promise<void> {
        const now = new Date();
        const deals = await this.dealRepository.find({
            where: {
                stage: DealStage.POST_SCHEDULED,
                scheduledAt: LessThanOrEqual(now),
            },
        });

        this.logger.log(
            `Posting worker tick: ${deals.length} deals ready for publish`,
        );

        for (const deal of deals) {
            await this.publishDeal(deal.id);
        }
    }

    @Cron(POST_VERIFICATION_CRON)
    async handleVerificationCron(): Promise<void> {
        const now = new Date();
        const deals = await this.dealRepository.find({
            where: {stage: DealStage.POSTED_VERIFYING},
        });

        this.logger.log(
            `Verification worker tick: ${deals.length} deals to verify`,
        );

        for (const deal of deals) {
            await this.verifyDeal(deal.id, now);
        }
    }

    private async publishDeal(dealId: string): Promise<void> {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});
        if (!deal) {
            return;
        }

        const escrow = await this.escrowRepository.findOne({
            where: {dealId: deal.id},
        });
        if (!escrow || escrow.status !== EscrowStatus.PAID_CONFIRMED) {
            return;
        }

        const channel = await this.channelRepository.findOne({
            where: {id: deal.channelId},
        });
        if (!channel) {
            return;
        }

        const rights = await this.telegramPosterService.checkCanPost(channel);
        if (!rights.ok) {
            this.logger.warn(
                `Posting failed: bot not admin for deal ${deal.id}, reason=${rights.reason}`,
            );
            await this.upsertPublication(deal.id, {
                status: PublicationStatus.FAILED,
                error: 'BOT_NOT_ADMIN',
            });
            await this.paymentsService.refundEscrow(deal.id, 'BOT_NOT_ADMIN');
            await this.dealRepository.update(deal.id, {
                stage: DealStage.FINALIZED,
                status: DealStatus.CANCELED,
            });
            await this.dealsNotificationsService.notifyPostNotPublishedAdmin(
                deal,
            );
            await this.dealsNotificationsService.notifyAdvertiser(
                deal,
                'telegram.deal.post.not_published_advertiser',
            );
            return;
        }

        const creative = await this.creativeRepository.findOne({
            where: {dealId: deal.id, status: CreativeStatus.APPROVED},
            order: {version: 'DESC'},
        });
        if (!creative) {
            return;
        }

        try {
            await this.dealRepository.update(deal.id, {
                stage: DealStage.POST_PUBLISHING,
            });
            const result = await this.telegramPosterService.publishCreativeToChannel(
                deal,
                creative,
                channel,
            );

            const publishedAt = new Date();
            const listingSnapshot = deal.listingSnapshot as {
                visibilityDurationHours?: number;
            };
            const mustRemainUntil = listingSnapshot.visibilityDurationHours
                ? new Date(
                      publishedAt.getTime() +
                          listingSnapshot.visibilityDurationHours * 60 * 60 * 1000,
                  )
                : null;

            await this.upsertPublication(deal.id, {
                status: PublicationStatus.POSTED,
                publishedMessageId: String(result.message_id),
                publishedAt,
                mustRemainUntil,
            });

            await this.dealRepository.update(deal.id, {
                stage: DealStage.POSTED_VERIFYING,
                status: DealStatus.ACTIVE,
            });

            await this.dealsNotificationsService.notifyAdvertiser(
                deal,
                'telegram.deal.post.published',
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Posting failed for deal ${deal.id}: ${message}`);
            await this.upsertPublication(deal.id, {
                status: PublicationStatus.FAILED,
                error: message,
            });
            await this.paymentsService.refundEscrow(deal.id, 'POST_FAILED');
            await this.dealRepository.update(deal.id, {
                stage: DealStage.FINALIZED,
                status: DealStatus.CANCELED,
            });
        }
    }

    private async verifyDeal(dealId: string, now: Date): Promise<void> {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});
        if (!deal) {
            return;
        }

        const publication = await this.publicationRepository.findOne({
            where: {dealId: deal.id},
        });
        if (!publication || !publication.mustRemainUntil) {
            return;
        }

        const channel = await this.channelRepository.findOne({
            where: {id: deal.channelId},
        });
        if (!channel) {
            return;
        }

        if (publication.publishedMessageId) {
            const exists = await this.telegramPosterService.checkMessagePresence(
                channel,
                publication.publishedMessageId,
            );
            if (!exists.ok && exists.reason === 'MESSAGE_NOT_FOUND') {
                await this.publicationRepository.update(publication.id, {
                    status: PublicationStatus.DELETED_OR_EDITED,
                    lastCheckedAt: now,
                });
                await this.paymentsService.refundEscrow(
                    deal.id,
                    'POST_DELETED',
                );
                await this.dealRepository.update(deal.id, {
                    stage: DealStage.FINALIZED,
                    status: DealStatus.CANCELED,
                });
                await this.dealsNotificationsService.notifyPostDeletedAdmin(
                    deal,
                );
                await this.dealsNotificationsService.notifyAdvertiser(
                    deal,
                    'telegram.deal.post.deleted_advertiser',
                );
                return;
            }
            if (!exists.ok) {
                this.logger.warn(
                    `Delivery check failed for deal ${deal.id}: ${exists.reason}`,
                );
                return;
            }
        }

        if (now < publication.mustRemainUntil) {
            await this.publicationRepository.update(publication.id, {
                lastCheckedAt: now,
            });
            return;
        }

        await this.publicationRepository.update(publication.id, {
            lastCheckedAt: now,
        });
        await this.publicationRepository.update(publication.id, {
            status: PublicationStatus.VERIFIED,
            verifiedAt: now,
        });

        await this.paymentsService.releaseEscrow(deal.id, 'DELIVERY_CONFIRMED');
        await this.dealRepository.update(deal.id, {
            stage: DealStage.FINALIZED,
            status: DealStatus.COMPLETED,
        });

        const escrow = await this.escrowRepository.findOne({
            where: {dealId: deal.id},
        });

        await this.dealsNotificationsService.notifyAdvertiser(
            deal,
            'telegram.deal.post.delivery_confirmed',
        );

        await this.dealsNotificationsService.notifyAdvertiser(
            deal,
            'telegram.deal.post.completed_advertiser',
        );

        if (escrow?.currency && (escrow.paidNano || escrow.amountNano)) {
            await this.dealsNotificationsService.notifyDealCompletedAdmin(
                deal,
                escrow.paidNano ?? escrow.amountNano,
                escrow.currency,
            );
        }
    }

    private async upsertPublication(
        dealId: string,
        data: Partial<DealPublicationEntity>,
    ): Promise<void> {
        const existing = await this.publicationRepository.findOne({
            where: {dealId},
        });

        if (existing) {
            await this.publicationRepository.update(existing.id, data);
            return;
        }

        const created = this.publicationRepository.create({
            dealId,
            status: PublicationStatus.NOT_POSTED,
            ...data,
        });
        await this.publicationRepository.save(created);
    }
}
