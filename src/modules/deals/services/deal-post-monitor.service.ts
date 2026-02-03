import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {DealPublicationEntity} from '../entities/deal-publication.entity';
import {ChannelEntity} from '../../channels/entities/channel.entity';
import {DealsNotificationsService} from '../deals-notifications.service';
import {DealStage} from '../../../common/constants/deals/deal-stage.constants';
import {DealStatus} from '../../../common/constants/deals/deal-status.constants';

const POST_EDITED_NOTIFIED = 'POST_EDITED_NOTIFIED';

@Injectable()
export class DealPostMonitorService {
    private readonly logger = new Logger(DealPostMonitorService.name);

    constructor(
        @InjectRepository(DealPublicationEntity)
        private readonly publicationRepository: Repository<DealPublicationEntity>,
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        private readonly dealsNotificationsService: DealsNotificationsService,
    ) {}

    async handleEditedChannelPost(payload: {
        chatId: string | number;
        username?: string | null;
        messageId: string | number;
    }): Promise<void> {
        const channel = await this.resolveChannel(payload.chatId, payload.username);
        if (!channel) {
            return;
        }

        const publication = await this.publicationRepository
            .createQueryBuilder('publication')
            .innerJoinAndSelect('publication.deal', 'deal')
            .where('publication.publishedMessageId = :messageId', {
                messageId: String(payload.messageId),
            })
            .andWhere('deal.channelId = :channelId', {channelId: channel.id})
            .getOne();

        if (!publication?.deal) {
            return;
        }

        if (
            publication.deal.stage !== DealStage.POSTED_VERIFYING ||
            publication.deal.status !== DealStatus.ACTIVE
        ) {
            return;
        }

        if (publication.error === POST_EDITED_NOTIFIED) {
            return;
        }

        await this.publicationRepository.update(publication.id, {
            error: POST_EDITED_NOTIFIED,
            lastCheckedAt: new Date(),
        });

        await this.dealsNotificationsService.notifyAdvertiser(
            publication.deal,
            'telegram.deal.post.edited_advertiser',
        );
    }

    private async resolveChannel(
        chatId: string | number,
        username?: string | null,
    ): Promise<ChannelEntity | null> {
        const chatIdValue = chatId ? String(chatId) : null;
        const usernameValue = username ? String(username).replace('@', '') : null;
        if (!chatIdValue && !usernameValue) {
            return null;
        }

        const candidates = await this.channelRepository.find({
            where: [
                ...(chatIdValue ? [{telegramChatId: chatIdValue}] : []),
                ...(usernameValue ? [{username: usernameValue}] : []),
            ],
        });

        if (candidates.length > 1) {
            this.logger.warn(
                `Multiple channels matched edited post: chatId=${chatIdValue} username=${usernameValue}`,
            );
        }

        return candidates[0] ?? null;
    }
}
