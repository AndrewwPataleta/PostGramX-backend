import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {DealEntity} from './entities/deal.entity';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {ChannelParticipantsService} from '../channels/channel-participants.service';
import {DealsDeepLinkService} from './deals-deep-link.service';
import {TelegramBotService} from '../telegram-bot/telegram-bot.service';

const NOTIFICATION_CONCURRENCY = 5;

type DealActionReason = 'verification' | 'approval' | 'payment' | 'publish';

@Injectable()
export class DealsNotificationsService {
    private readonly logger = new Logger(DealsNotificationsService.name);
    constructor(
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        private readonly participantsService: ChannelParticipantsService,
        private readonly deepLinkService: DealsDeepLinkService,
        private readonly telegramBotService: TelegramBotService,
    ) {}

    async notifyDealCreated(deal: DealEntity): Promise<void> {
        await this.notifyDeal(deal, {
            type: 'DEAL_CREATED',
            header: 'New deal request',
            actionLine: 'Action: Please review and confirm in the Mini App.',
        });
    }

    async notifyDealActionRequired(
        deal: DealEntity,
        reason: DealActionReason,
    ): Promise<void> {
        const reasonLabel = this.formatReason(reason);
        await this.notifyDeal(deal, {
            type: 'ACTION_REQUIRED',
            header: 'Deal action required',
            actionLine: `Action: ${reasonLabel}.`,
        });
    }

    private async notifyDeal(
        deal: DealEntity,
        payload: {type: string; header: string; actionLine: string},
    ): Promise<void> {
        if (!deal.channelId) {
            this.logger.warn(
                `Skipping deal notification: missing channelId for deal ${deal.id}`,
            );
            return;
        }

        const channel = await this.channelRepository.findOne({
            where: {id: deal.channelId},
        });

        if (!channel) {
            this.logger.warn(
                `Skipping deal notification: channel not found for deal ${deal.id}`,
            );
            return;
        }

        const recipients = await this.participantsService.getNotificationRecipients(
            deal.channelId,
        );
        if (recipients.length === 0) {
            this.logger.log(
                `No recipients found for deal notification: dealId=${deal.id} channelId=${deal.channelId}`,
            );
            return;
        }

        const link = this.deepLinkService.buildDealLink(deal.id);
        const message = this.formatMessage(deal, channel, payload.header, payload.actionLine);
        const keyboard = {
            inline_keyboard: [[{text: 'Open Deal', url: link}]],
        };

        this.logger.log(
            `Sending deal notification ${payload.type}: dealId=${deal.id} channelId=${deal.channelId} recipients=${recipients.length}`,
        );

        await this.runWithConcurrency(
            recipients,
            NOTIFICATION_CONCURRENCY,
            async (recipient) => {
                try {
                    await this.telegramBotService.sendMessage(
                        recipient.telegramId as string,
                        message,
                        {
                            reply_markup: keyboard,
                            parse_mode: 'HTML',
                        },
                    );
                } catch (error) {
                    const errorMessage =
                        error instanceof Error ? error.message : String(error);
                    this.logger.warn(
                        `Failed to send deal notification: dealId=${deal.id} recipient=${recipient.id} error=${errorMessage}`,
                    );
                }
            },
        );
    }

    private formatMessage(
        deal: DealEntity,
        channel: ChannelEntity,
        header: string,
        actionLine: string,
    ): string {
        const channelLine = channel.username
            ? `Channel: <b>${channel.title}</b> (@${channel.username})`
            : `Channel: <b>${channel.title}</b>`;
        const dealShortId = deal.id.slice(0, 8);
        const statusLine = `Status: ${deal.status ?? 'unknown'} / ${deal.escrowStatus ?? 'unknown'}`;
        const initiatorLine = `Initiator: ${deal.sideInitiator ?? 'unknown'}`;

        return [
            `<b>${header}</b>`,
            channelLine,
            `Deal: ${dealShortId}`,
            statusLine,
            initiatorLine,
            actionLine,
        ].join('\n');
    }

    private formatReason(reason: DealActionReason): string {
        switch (reason) {
            case 'verification':
                return 'Verification required';
            case 'approval':
                return 'Approval required';
            case 'payment':
                return 'Payment required';
            case 'publish':
                return 'Publish confirmation required';
            default:
                return 'Action required';
        }
    }

    private async runWithConcurrency<T>(
        items: T[],
        limit: number,
        task: (item: T) => Promise<void>,
    ): Promise<void> {
        const queue = [...items];
        const workerCount = Math.min(limit, queue.length);

        const workers = Array.from({length: workerCount}, async () => {
            while (queue.length > 0) {
                const item = queue.shift();
                if (!item) {
                    return;
                }
                await task(item);
            }
        });

        await Promise.all(workers);
    }
}
