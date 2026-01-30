import {forwardRef, Inject, Injectable, Logger} from '@nestjs/common';
import {Cron} from '@nestjs/schedule';
import {InjectRepository} from '@nestjs/typeorm';
import {
    DataSource,
    In,
    LessThanOrEqual,
    Repository,
} from 'typeorm';
import {DealEntity} from './entities/deal.entity';
import {DealEscrowStatus} from './types/deal-escrow-status.enum';
import {DealStatus} from './types/deal-status.enum';
import {DealReminderEntity} from './entities/deal-reminder.entity';
import {DealReminderType} from './types/deal-reminder-type.enum';
import {DEAL_TIMEOUTS_CRON, DEALS_CONFIG} from '../../config/deals.config';
import {DealsDeepLinkService} from './deals-deep-link.service';
import {TelegramBotService} from '../telegram-bot/telegram-bot.service';
import {User} from '../auth/entities/user.entity';
import {assertTransitionAllowed} from './state/deal-state.machine';
import {WalletsService} from '../payments/wallets/wallets.service';
import {ConfigService} from '@nestjs/config';

const AGREEMENT_ESCROW_STATUSES = [
    DealEscrowStatus.SCHEDULING_PENDING,
    DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
    DealEscrowStatus.CREATIVE_RECEIVED,
    DealEscrowStatus.CREATIVE_AWAITING_ADMIN_REVIEW,
    DealEscrowStatus.CREATIVE_AWAITING_CONFIRM,
    DealEscrowStatus.ADMIN_REVIEW,
    DealEscrowStatus.PAYMENT_WINDOW_PENDING,
    DealEscrowStatus.PAYMENT_AWAITING,
    DealEscrowStatus.FUNDS_PENDING,
];

const CREATIVE_PENDING_STATUSES = [
    DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
];

type CancelReason =
    | 'IDLE_EXPIRED'
    | 'CREATIVE_NOT_SUBMITTED'
    | 'ADMIN_NO_RESPONSE'
    | 'PAYMENT_TIMEOUT'
    | 'ADMIN_RIGHTS_LOST'
    | 'USER_CANCELED';

@Injectable()
export class DealsTimeoutsService {
    private readonly logger = new Logger(DealsTimeoutsService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly configService: ConfigService,
        @InjectRepository(DealEntity)
        private readonly dealRepository: Repository<DealEntity>,
        @InjectRepository(DealReminderEntity)
        private readonly reminderRepository: Repository<DealReminderEntity>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @Inject(forwardRef(() => TelegramBotService))
        private readonly telegramBotService: TelegramBotService,
        private readonly deepLinkService: DealsDeepLinkService,
        private readonly walletsService: WalletsService,
    ) {}

    @Cron(DEAL_TIMEOUTS_CRON)
    async handleDealTimeouts(): Promise<void> {
        await this.sendReminders();
        await this.cancelExpiredDeals();
    }

    private async cancelExpiredDeals(): Promise<void> {
        const now = new Date();
        await this.cancelIdleExpired(now);
        await this.cancelCreativeExpired(now);
        await this.cancelAdminExpired(now);
        await this.cancelPaymentExpired(now);
    }

    private async cancelIdleExpired(now: Date): Promise<void> {
        const expiredDeals = await this.dealRepository.find({
            where: {
                status: DealStatus.PENDING,
                escrowStatus: In(AGREEMENT_ESCROW_STATUSES),
                idleExpiresAt: LessThanOrEqual(now),
            },
        });

        await this.cancelDeals(expiredDeals, {
            reason: 'IDLE_EXPIRED',
            allowedEscrowStatuses: AGREEMENT_ESCROW_STATUSES,
        });
    }

    private async cancelCreativeExpired(now: Date): Promise<void> {
        const expiredDeals = await this.dealRepository.find({
            where: {
                status: DealStatus.PENDING,
                escrowStatus: In(CREATIVE_PENDING_STATUSES),
                creativeDeadlineAt: LessThanOrEqual(now),
            },
        });

        await this.cancelDeals(expiredDeals, {
            reason: 'CREATIVE_NOT_SUBMITTED',
            allowedEscrowStatuses: CREATIVE_PENDING_STATUSES,
        });
    }

    private async cancelAdminExpired(now: Date): Promise<void> {
        const expiredDeals = await this.dealRepository.find({
            where: {
                status: DealStatus.PENDING,
                escrowStatus: In([
                    DealEscrowStatus.CREATIVE_AWAITING_ADMIN_REVIEW,
                    DealEscrowStatus.ADMIN_REVIEW,
                ]),
                adminReviewDeadlineAt: LessThanOrEqual(now),
            },
        });

        await this.cancelDeals(expiredDeals, {
            reason: 'ADMIN_NO_RESPONSE',
            allowedEscrowStatuses: [
                DealEscrowStatus.CREATIVE_AWAITING_ADMIN_REVIEW,
                DealEscrowStatus.ADMIN_REVIEW,
            ],
            notifyAdmins: true,
        });
    }

    private async cancelPaymentExpired(now: Date): Promise<void> {
        const expiredDeals = await this.dealRepository
            .createQueryBuilder('deal')
            .where('deal.status = :status', {status: DealStatus.PENDING})
            .andWhere('deal.escrowStatus IN (:...escrowStatuses)', {
                escrowStatuses: [
                    DealEscrowStatus.PAYMENT_WINDOW_PENDING,
                    DealEscrowStatus.PAYMENT_AWAITING,
                ],
            })
            .andWhere(
                '(deal.paymentDeadlineAt IS NOT NULL AND deal.paymentDeadlineAt <= :now)' +
                    'OR (deal.paymentDeadlineAt IS NULL AND deal.escrowExpiresAt IS NOT NULL AND deal.escrowExpiresAt <= :now)',
                {now},
            )
            .getMany();

        await this.cancelDeals(expiredDeals, {
            reason: 'PAYMENT_TIMEOUT',
            allowedEscrowStatuses: [
                DealEscrowStatus.PAYMENT_WINDOW_PENDING,
                DealEscrowStatus.PAYMENT_AWAITING,
            ],
            closeWallet: true,
        });
    }

    private async cancelDeals(
        deals: DealEntity[],
        options: {
            reason: CancelReason;
            allowedEscrowStatuses: DealEscrowStatus[];
            notifyAdmins?: boolean;
            closeWallet?: boolean;
        },
    ): Promise<void> {
        for (const deal of deals) {
            await this.cancelDeal(deal, options);
        }
    }

    private async cancelDeal(
        deal: DealEntity,
        options: {
            reason: CancelReason;
            allowedEscrowStatuses: DealEscrowStatus[];
            notifyAdmins?: boolean;
            closeWallet?: boolean;
        },
    ): Promise<void> {
        const now = new Date();
        try {
            assertTransitionAllowed(deal.escrowStatus, DealEscrowStatus.CANCELED);
        } catch (error) {
            this.logger.warn(
                `Skipping cancel for dealId=${deal.id} invalid transition: ${deal.escrowStatus}`,
            );
            return;
        }

        let updated = false;
        await this.dataSource.transaction(async (manager) => {
            const result = await manager
                .createQueryBuilder()
                .update(DealEntity)
                .set({
                    status: DealStatus.CANCELED,
                    escrowStatus: DealEscrowStatus.CANCELED,
                    cancelReason: options.reason,
                    lastActivityAt: now,
                    stalledAt: now,
                })
                .where('id = :id', {id: deal.id})
                .andWhere('status = :status', {status: DealStatus.PENDING})
                .andWhere('escrowStatus IN (:...statuses)', {
                    statuses: options.allowedEscrowStatuses,
                })
                .execute();

            if (result.affected && result.affected > 0) {
                updated = true;
                if (options.closeWallet && deal.escrowWalletId) {
                    await this.walletsService.closeWallet(
                        deal.escrowWalletId,
                        manager,
                    );
                }
            }
        });

        if (!updated) {
            return;
        }

        await this.notifyCancellation(deal, options.reason, options.notifyAdmins);
    }

    private async sendReminders(): Promise<void> {
        const now = new Date();
        await this.sendIdleReminder(now);
        await this.sendCreativeReminder(now);
        await this.sendAdminReminder(now);
        await this.sendPaymentReminder(now);
    }

    private async sendIdleReminder(now: Date): Promise<void> {
        const cutoff = this.addMinutes(
            now,
            DEALS_CONFIG.REMINDER_BEFORE_EXPIRE_MINUTES,
        );
        const deals = await this.dealRepository
            .createQueryBuilder('deal')
            .leftJoin(
                DealReminderEntity,
                'reminder',
                'reminder.dealId = deal.id AND reminder.type = :type',
                {type: DealReminderType.IDLE_EXPIRE},
            )
            .where('reminder.id IS NULL')
            .andWhere('deal.status = :status', {status: DealStatus.PENDING})
            .andWhere('deal.escrowStatus IN (:...statuses)', {
                statuses: AGREEMENT_ESCROW_STATUSES,
            })
            .andWhere('deal.idleExpiresAt IS NOT NULL')
            .andWhere('deal.idleExpiresAt > :now', {now})
            .andWhere('deal.idleExpiresAt <= :cutoff', {cutoff})
            .getMany();

        for (const deal of deals) {
            await this.sendReminderOnce(deal, DealReminderType.IDLE_EXPIRE, async () => {
                const minutesLeft = this.diffMinutes(deal.idleExpiresAt, now);
                const text = `⏰ This deal will expire in ${minutesLeft} minutes without activity.`;
                const buttons = this.buildReminderButtons(deal, false);
                await this.notifyBuyer(deal, text, buttons);
            });
        }
    }

    private async sendCreativeReminder(now: Date): Promise<void> {
        const cutoff = this.addMinutes(now, DEALS_CONFIG.REMINDER_BEFORE_EXPIRE_MINUTES);
        const deals = await this.dealRepository
            .createQueryBuilder('deal')
            .leftJoin(
                DealReminderEntity,
                'reminder',
                'reminder.dealId = deal.id AND reminder.type = :type',
                {type: DealReminderType.CREATIVE_DEADLINE},
            )
            .where('reminder.id IS NULL')
            .andWhere('deal.status = :status', {status: DealStatus.PENDING})
            .andWhere('deal.escrowStatus IN (:...statuses)', {
                statuses: CREATIVE_PENDING_STATUSES,
            })
            .andWhere('deal.creativeDeadlineAt IS NOT NULL')
            .andWhere('deal.creativeDeadlineAt > :now', {now})
            .andWhere('deal.creativeDeadlineAt <= :cutoff', {cutoff})
            .getMany();

        for (const deal of deals) {
            await this.sendReminderOnce(deal, DealReminderType.CREATIVE_DEADLINE, async () => {
                const minutesLeft = this.diffMinutes(
                    deal.creativeDeadlineAt,
                    now,
                );
                const text = `⚠️ You need to send the post to the bot within ${minutesLeft} minutes or the deal will be canceled.`;
                const buttons = this.buildReminderButtons(deal, true);
                await this.notifyBuyer(deal, text, buttons);
            });
        }
    }

    private async sendAdminReminder(now: Date): Promise<void> {
        const cutoff = this.addMinutes(
            now,
            DEALS_CONFIG.REMINDER_BEFORE_ADMIN_DEADLINE_MINUTES,
        );
        const deals = await this.dealRepository
            .createQueryBuilder('deal')
            .leftJoin(
                DealReminderEntity,
                'reminder',
                'reminder.dealId = deal.id AND reminder.type = :type',
                {type: DealReminderType.ADMIN_DEADLINE},
            )
            .where('reminder.id IS NULL')
            .andWhere('deal.status = :status', {status: DealStatus.PENDING})
            .andWhere('deal.escrowStatus = :escrowStatus', {
                escrowStatus: DealEscrowStatus.ADMIN_REVIEW,
            })
            .andWhere('deal.adminReviewDeadlineAt IS NOT NULL')
            .andWhere('deal.adminReviewDeadlineAt > :now', {now})
            .andWhere('deal.adminReviewDeadlineAt <= :cutoff', {cutoff})
            .getMany();

        for (const deal of deals) {
            await this.sendReminderOnce(deal, DealReminderType.ADMIN_DEADLINE, async () => {
                const hoursLeft = this.diffHours(deal.adminReviewDeadlineAt, now);
                const text = `⏳ New ad request is waiting for your review. Please approve, request changes, or reject within ${hoursLeft} hours.`;
                const buttons = this.buildReminderButtons(deal, false);
                await this.notifyAdmins(deal, text, buttons);
            });
        }
    }

    private async sendPaymentReminder(now: Date): Promise<void> {
        const cutoff = this.addMinutes(
            now,
            DEALS_CONFIG.REMINDER_BEFORE_PAYMENT_DEADLINE_MINUTES,
        );
        const deals = await this.dealRepository
            .createQueryBuilder('deal')
            .leftJoin(
                DealReminderEntity,
                'reminder',
                'reminder.dealId = deal.id AND reminder.type = :type',
                {type: DealReminderType.PAYMENT_DEADLINE},
            )
            .where('reminder.id IS NULL')
            .andWhere('deal.status = :status', {status: DealStatus.PENDING})
            .andWhere('deal.escrowStatus IN (:...escrowStatuses)', {
                escrowStatuses: [
                    DealEscrowStatus.PAYMENT_WINDOW_PENDING,
                    DealEscrowStatus.PAYMENT_AWAITING,
                ],
            })
            .andWhere(
                '(deal.paymentDeadlineAt IS NOT NULL AND deal.paymentDeadlineAt > :now AND deal.paymentDeadlineAt <= :cutoff)' +
                    'OR (deal.paymentDeadlineAt IS NULL AND deal.escrowExpiresAt IS NOT NULL AND deal.escrowExpiresAt > :now AND deal.escrowExpiresAt <= :cutoff)',
                {now, cutoff},
            )
            .getMany();

        for (const deal of deals) {
            await this.sendReminderOnce(deal, DealReminderType.PAYMENT_DEADLINE, async () => {
                const deadline = deal.paymentDeadlineAt ?? deal.escrowExpiresAt;
                const minutesLeft = this.diffMinutes(deadline, now);
                const text = `💳 Payment window ends in ${minutesLeft} minutes. Please pay to keep the slot.`;
                const buttons = this.buildReminderButtons(deal, false);
                await this.notifyBuyer(deal, text, buttons);
            });
        }
    }

    private async sendReminderOnce(
        deal: DealEntity,
        type: DealReminderType,
        send: () => Promise<void>,
    ): Promise<void> {
        const sentAt = new Date();
        try {
            await this.reminderRepository.insert({
                dealId: deal.id,
                type,
                sentAt,
            });
        } catch (error) {
            if (this.isUniqueViolation(error)) {
                return;
            }
            throw error;
        }

        await send();
    }

    private async notifyBuyer(
        deal: DealEntity,
        text: string,
        buttons: {text: string; url: string}[][],
    ): Promise<void> {
        const user = await this.userRepository.findOne({
            where: {id: deal.advertiserUserId},
        });
        if (!user?.telegramId) {
            return;
        }
        await this.telegramBotService.sendDealReminderToUser(
            user.telegramId,
            text,
            buttons,
        );
    }

    private async notifyAdmins(
        deal: DealEntity,
        text: string,
        buttons: {text: string; url: string}[][],
    ): Promise<void> {
        if (!deal.channelId) {
            return;
        }
        await this.telegramBotService.sendDealReminderToChannelAdmins(
            deal.channelId,
            text,
            buttons,
        );
    }

    private async notifyCancellation(
        deal: DealEntity,
        reason: CancelReason,
        notifyAdmins?: boolean,
    ): Promise<void> {
        const reasonText = this.formatCancelReason(reason);
        const buttons = this.buildReminderButtons(deal, false);
        await this.notifyBuyer(deal, `❌ Deal canceled: ${reasonText}`, buttons);

        if (notifyAdmins && deal.channelId) {
            await this.notifyAdmins(
                deal,
                `Deal ${deal.id.slice(0, 8)} was canceled due to no response in time.`,
                buttons,
            );
        }
    }

    private buildReminderButtons(
        deal: DealEntity,
        includeBot: boolean,
    ): {text: string; url: string}[][] {
        const buttons: {text: string; url: string}[] = [];
        const miniAppLink = this.deepLinkService.buildDealLink(deal.id);
        if (includeBot) {
            const botLink = this.buildBotLink(deal.id);
            if (botLink) {
                buttons.push({text: 'Open bot', url: botLink});
            }
        }
        buttons.push({text: 'Open mini app', url: miniAppLink});
        return buttons.length > 0 ? [buttons] : [];
    }

    private buildBotLink(dealId: string): string | null {
        const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME');
        if (!botUsername) {
            return null;
        }
        return `https://t.me/${botUsername}?start=deal_${dealId}`;
    }

    private formatCancelReason(reason: CancelReason): string {
        switch (reason) {
            case 'IDLE_EXPIRED':
                return 'no activity before the deadline.';
            case 'CREATIVE_NOT_SUBMITTED':
                return 'creative was not submitted in time.';
            case 'ADMIN_NO_RESPONSE':
                return 'admins did not respond in time.';
            case 'PAYMENT_TIMEOUT':
                return 'payment was not received in time.';
            case 'ADMIN_RIGHTS_LOST':
                return 'admins no longer have required rights.';
            case 'USER_CANCELED':
                return 'canceled by user.';
            default:
                return 'canceled.';
        }
    }

    private addMinutes(date: Date, minutes: number): Date {
        return new Date(date.getTime() + minutes * 60_000);
    }

    private diffMinutes(deadline: Date | null | undefined, now: Date): number {
        if (!deadline) {
            return 0;
        }
        return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 60_000));
    }

    private diffHours(deadline: Date | null | undefined, now: Date): number {
        if (!deadline) {
            return 0;
        }
        return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 3_600_000));
    }

    private isUniqueViolation(error: unknown): boolean {
        if (!error || typeof error !== 'object') {
            return false;
        }
        const code = (error as {code?: string}).code;
        return code === '23505';
    }
}
