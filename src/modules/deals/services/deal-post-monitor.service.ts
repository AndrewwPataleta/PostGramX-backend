import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DealPublicationEntity } from '../entities/deal-publication.entity';
import { ChannelEntity } from '../../channels/entities/channel.entity';
import { DealStage } from '../../../common/constants/deals/deal-stage.constants';
import { DealStatus } from '../../../common/constants/deals/deal-status.constants';
import { DEAL_PUBLICATION_ERRORS } from '../../../common/constants/deals/deal-publication-errors.constants';
import { TelegramChannelPostsService } from '../../telegram/services/telegram-channel-posts.service';
import {
  fingerprintEntities,
  fingerprintKeyboard,
  fingerprintMedia,
  normalizeText,
  TelegramMessage,
} from '../publication/telegramMessageFingerprint';
import { MIN_EDIT_CHECK_INTERVAL_MS } from '../../../common/constants/deals/deal-post-monitor.constants';

@Injectable()
export class DealPostMonitorService {
  private readonly logger = new Logger(DealPostMonitorService.name);

  constructor(
    @InjectRepository(DealPublicationEntity)
    private readonly publicationRepository: Repository<DealPublicationEntity>,
    @InjectRepository(ChannelEntity)
    private readonly channelRepository: Repository<ChannelEntity>,
    private readonly telegramChannelPostsService: TelegramChannelPostsService,
    private readonly dataSource: DataSource,
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

    const now = new Date();
    const messageId = String(payload.messageId);

    await this.dataSource.transaction(async (manager) => {
      const publication = await manager
        .getRepository(DealPublicationEntity)
        .createQueryBuilder('publication')
        .setLock('pessimistic_write')
        .innerJoinAndSelect('publication.deal', 'deal')
        .where('publication.publishedMessageId = :messageId', { messageId })
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

      if (
        publication.lastCheckedAt &&
        now.getTime() - publication.lastCheckedAt.getTime() <
          MIN_EDIT_CHECK_INTERVAL_MS
      ) {
        return;
      }

      const currentMessage = await this.fetchCurrentMessage(
        channel,
        publication.publishedMessageId,
      );
      if (!currentMessage) {
        return;
      }

      if (!this.hasBaselineSnapshot(publication)) {
        await manager
          .getRepository(DealPublicationEntity)
          .update(publication.id, {
            ...this.snapshotFromMessage(currentMessage),
            lastCheckedAt: now,
          });
        this.logger.log(
          JSON.stringify({
            event: 'post_snapshot_captured_late',
            dealId: publication.dealId,
            publicationId: publication.id,
            messageId: publication.publishedMessageId,
            channelId: channel.id,
          }),
        );
        return;
      }

      const currentText = normalizeText(currentMessage.text);
      const currentCaption = normalizeText(currentMessage.caption);
      const currentMediaFingerprint = fingerprintMedia(currentMessage);
      const currentKeyboardFingerprint = fingerprintKeyboard(currentMessage);
      const currentEntitiesFingerprint = fingerprintEntities(currentMessage);

      const baselineEntitiesFingerprint =
        (publication.publishedMessageSnapshotJson?.entitiesFingerprint as
          | string
          | undefined) ?? 'none';

      const textDiff = publication.publishedMessageText !== currentText;
      const captionDiff =
        publication.publishedMessageCaption !== currentCaption;
      const mediaDiff =
        publication.publishedMessageMediaFingerprint !==
        currentMediaFingerprint;
      const keyboardDiff =
        publication.publishedMessageKeyboardFingerprint !==
        currentKeyboardFingerprint;
      const entitiesDiff =
        baselineEntitiesFingerprint !== currentEntitiesFingerprint;

      const isEdited =
        textDiff || captionDiff || mediaDiff || keyboardDiff || entitiesDiff;

      await manager
        .getRepository(DealPublicationEntity)
        .update(publication.id, {
          lastCheckedAt: now,
          ...(isEdited ? { error: DEAL_PUBLICATION_ERRORS.POST_EDITED } : {}),
        });

      if (isEdited) {
        this.logger.warn(
          JSON.stringify({
            event: 'post_edited_detected',
            dealId: publication.dealId,
            publicationId: publication.id,
            messageId: publication.publishedMessageId,
            channelId: channel.id,
            diffs: {
              text: textDiff,
              caption: captionDiff,
              media: mediaDiff,
              keyboard: keyboardDiff,
              entities: entitiesDiff,
            },
          }),
        );
      }
    });
  }

  private async fetchCurrentMessage(
    channel: ChannelEntity,
    messageId: string | null,
  ): Promise<TelegramMessage | null> {
    if (!messageId) {
      return null;
    }

    if (!channel.telegramChatId && !channel.username) {
      return null;
    }

    try {
      return await this.telegramChannelPostsService.getChannelMessage(
        channel.telegramChatId ?? `@${channel.username}`,
        messageId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const [errorCode] = message.split(':');
      if (errorCode === '400' || errorCode === '403') {
        this.logger.warn(
          `Skip edited-post check due Telegram API error for message ${messageId}: ${message}`,
        );
        return null;
      }
      this.logger.warn(
        `Unexpected Telegram API error for message ${messageId}: ${message}`,
      );
      return null;
    }
  }

  private hasBaselineSnapshot(publication: DealPublicationEntity): boolean {
    return (
      publication.publishedMessageText !== null ||
      publication.publishedMessageCaption !== null ||
      publication.publishedMessageMediaFingerprint !== null ||
      publication.publishedMessageKeyboardFingerprint !== null
    );
  }

  private snapshotFromMessage(
    message: TelegramMessage,
  ): Partial<DealPublicationEntity> {
    return {
      publishedMessageText: normalizeText(message.text),
      publishedMessageCaption: normalizeText(message.caption),
      publishedMessageMediaFingerprint: fingerprintMedia(message),
      publishedMessageKeyboardFingerprint: fingerprintKeyboard(message),
      publishedMessageSnapshotJson: {
        source: 'telegram_api',
        text: message.text ?? null,
        caption: message.caption ?? null,
        mediaFingerprint: fingerprintMedia(message),
        keyboard: message.reply_markup?.inline_keyboard ?? null,
        entitiesFingerprint: fingerprintEntities(message),
      },
    };
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
