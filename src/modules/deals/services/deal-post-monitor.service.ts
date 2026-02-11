import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DealPublicationEntity } from '../entities/deal-publication.entity';
import { ChannelEntity } from '../../channels/entities/channel.entity';
import { DealStage } from '../../../common/constants/deals/deal-stage.constants';
import { DealStatus } from '../../../common/constants/deals/deal-status.constants';
import { DEAL_PUBLICATION_ERRORS } from '../../../common/constants/deals/deal-publication-errors.constants';

@Injectable()
export class DealPostMonitorService {
  private readonly logger = new Logger(DealPostMonitorService.name);

  constructor(
    @InjectRepository(DealPublicationEntity)
    private readonly publicationRepository: Repository<DealPublicationEntity>,
    @InjectRepository(ChannelEntity)
    private readonly channelRepository: Repository<ChannelEntity>,
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
      .andWhere('deal.channelId = :channelId', { channelId: channel.id })
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

    if (publication.error === DEAL_PUBLICATION_ERRORS.POST_EDITED) {
      return;
    }

    await this.publicationRepository.update(publication.id, {
      error: DEAL_PUBLICATION_ERRORS.POST_EDITED,
      lastCheckedAt: new Date(),
    });
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
        ...(chatIdValue ? [{ telegramChatId: chatIdValue }] : []),
        ...(usernameValue ? [{ username: usernameValue }] : []),
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
