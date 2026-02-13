import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DealPublicationEntity } from '../../deals/entities/deal-publication.entity';
import { DealEntity } from '../../deals/entities/deal.entity';
import { ListingEntity } from '../../listings/entities/listing.entity';
import { DealStage } from '../../../common/constants/deals/deal-stage.constants';
import { DealStatus } from '../../../common/constants/deals/deal-status.constants';
import { DEAL_PUBLICATION_ERRORS } from '../../../common/constants/deals/deal-publication-errors.constants';
import { PublicationStatus } from '../../../common/constants/deals/publication-status.constants';
import { DealsNotificationsService } from '../../deals/deals-notifications.service';
import { DealCancelAndRefundService } from '../../deals/services/deal-cancel-refund.service';
import { PinVisibilityStatus } from '../../../common/constants/deals/pin-visibility-status.constants';
import { MTPROTO_MONITOR_CONFIG } from '../mtproto-monitor.config';
import {
  buildMessageFingerprintHash,
  normalizeFingerprintText,
} from '../utils/message-fingerprint.util';
import {
  MtprotoChannelMessage,
  MtprotoClientService,
} from './mtproto-client.service';
import { MtprotoPeerResolverService } from './mtproto-peer-resolver.service';

const PIN_VIOLATION_REASON = 'PIN_REMOVED_OR_NOT_PINNED';

@Injectable()
export class DealPostMtprotoMonitorService {
  private readonly logger = new Logger(DealPostMtprotoMonitorService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(DealPublicationEntity)
    private readonly publicationRepository: Repository<DealPublicationEntity>,
    @InjectRepository(DealEntity)
    private readonly dealRepository: Repository<DealEntity>,
    private readonly mtprotoClientService: MtprotoClientService,
    private readonly mtprotoPeerResolverService: MtprotoPeerResolverService,
    private readonly dealsNotificationsService: DealsNotificationsService,
    private readonly dealCancelAndRefundService: DealCancelAndRefundService,
  ) {}

  @Cron(MTPROTO_MONITOR_CONFIG.POLL_CRON)
  async runVerificationCron(): Promise<void> {
    if (!this.mtprotoClientService.isEnabled()) {
      return;
    }

    const acquired = await this.tryAdvisoryLock('mtproto:post-verify');
    if (!acquired) {
      return;
    }

    try {
      const candidates = await this.selectCandidates();
      await this.runWithConcurrency(
        candidates,
        MTPROTO_MONITOR_CONFIG.MAX_PARALLEL,
        async (publication) => this.verifyPublishedPost(publication.id),
      );

      this.logger.log(
        `MTProto verification checked ${candidates.length} publication(s)`,
      );
    } finally {
      await this.releaseAdvisoryLock('mtproto:post-verify');
    }
  }

  async handleEditedChannelPost(payload: {
    chatId?: string | number | null;
    username?: string | null;
    messageId: string | number;
  }): Promise<void> {
    if (!this.mtprotoClientService.isEnabled()) {
      return;
    }

    const messageId = String(payload.messageId);
    const publication = await this.publicationRepository
      .createQueryBuilder('publication')
      .innerJoinAndSelect('publication.deal', 'deal')
      .innerJoinAndSelect('deal.channel', 'channel')
      .where('publication.publishedMessageId = :messageId', { messageId })
      .andWhere('deal.stage = :stage', { stage: DealStage.POSTED_VERIFYING })
      .andWhere('deal.status = :status', { status: DealStatus.ACTIVE })
      .getOne();

    if (publication) {
      await this.verifyPublishedPost(publication.id);
    }
  }

  async verifyPublishedPost(publicationId: string): Promise<void> {
    if (!this.mtprotoClientService.isEnabled()) {
      return;
    }

    const publication = await this.publicationRepository.findOne({
      where: { id: publicationId },
      relations: ['deal', 'deal.channel'],
    });

    if (!publication?.deal?.channel || !publication.publishedMessageId) {
      return;
    }

    if (
      publication.deal.stage !== DealStage.POSTED_VERIFYING ||
      publication.deal.status !== DealStatus.ACTIVE
    ) {
      return;
    }

    const now = new Date();
    const peer = await this.mtprotoPeerResolverService.resolveChannelPeer(
      publication.deal.channel,
    );
    if (!peer) {
      return;
    }

    const messageId = Number(publication.publishedMessageId);

    let message = null;
    try {
      message = await this.mtprotoClientService.getChannelMessage(
        peer,
        messageId,
      );
    } catch (error) {
      this.logger.warn(
        `MTProto check skipped for publication ${publication.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    if (!message) {
      await this.markViolationIfNeeded(publication.id, 'POST_DELETED', now);
      return;
    }

    const currentHash = this.getMessageHash(message);
    const baselineHash =
      publication.publishedMessageHash ??
      buildMessageFingerprintHash({
        text:
          publication.publishedMessageText ??
          publication.publishedMessageCaption,
        mediaUniqueId: publication.publishedMessageMediaFingerprint,
        entitiesSignature:
          (publication.publishedMessageSnapshotJson?.entitiesFingerprint as
            | string
            | undefined) ?? null,
      });

    if (publication.publishedMessageHash !== baselineHash) {
      await this.publicationRepository.update(publication.id, {
        publishedMessageHash: baselineHash,
      });
    }

    if (currentHash !== baselineHash) {
      await this.markViolationIfNeeded(
        publication.id,
        DEAL_PUBLICATION_ERRORS.POST_EDITED,
        now,
      );
      return;
    }

    await this.publicationRepository.update(publication.id, {
      lastVerifiedAt: now,
      lastCheckedAt: now,
    });

    await this.verifyPinIfRequired(publication, peer, now);
  }

  private async verifyPinIfRequired(
    publication: DealPublicationEntity,
    peer: string,
    now: Date,
  ): Promise<void> {
    if (!publication.deal?.listingSnapshot) {
      return;
    }

    const listingSnapshot = publication.deal.listingSnapshot as {
      pinDurationHours?: number;
      visibleDurationHours?: number;
    };

    const pinRequired =
      Number(listingSnapshot.pinDurationHours ?? 0) > 0 ||
      Number(listingSnapshot.visibleDurationHours ?? 0) > 0;

    if (!pinRequired || !publication.publishedMessageId) {
      return;
    }

    let pinnedMessageId: number | null = null;
    try {
      pinnedMessageId = await this.mtprotoClientService.getPinnedMessage(peer);
    } catch {
      return;
    }

    if (
      String(pinnedMessageId ?? '') === String(publication.publishedMessageId)
    ) {
      await this.publicationRepository.update(publication.id, {
        pinVisibilityStatus: PinVisibilityStatus.PIN_OK,
        pinMissingFirstSeenAt: null,
        pinMissingLastCheckedAt: now,
        pinMissingCount: 0,
      });
      return;
    }

    const locked = await this.publicationRepository.findOne({
      where: { id: publication.id },
    });

    if (!locked || locked.error === PIN_VIOLATION_REASON) {
      return;
    }

    const missingCount = (locked.pinMissingCount ?? 0) + 1;
    const firstSeenAt = locked.pinMissingFirstSeenAt ?? now;
    const shouldWarn = !locked.pinMissingWarningSentAt;

    await this.publicationRepository.update(locked.id, {
      pinVisibilityStatus: PinVisibilityStatus.PIN_MISSING_WARNED,
      pinMissingFirstSeenAt: firstSeenAt,
      pinMissingLastCheckedAt: now,
      pinMissingCount: missingCount,
      pinMissingWarningSentAt: shouldWarn
        ? now
        : locked.pinMissingWarningSentAt,
    });

    if (shouldWarn) {
      await this.dealsNotificationsService.notifyPinMissingWarning(
        locked.dealId,
        true,
      );
      return;
    }

    if (missingCount >= 2) {
      await this.publicationRepository.update(locked.id, {
        pinVisibilityStatus: PinVisibilityStatus.PIN_MISSING_FINALIZED,
        pinMissingFinalizedAt: now,
      });
      await this.dealCancelAndRefundService.cancelForPinViolation(
        locked.dealId,
        PIN_VIOLATION_REASON,
      );
      await this.dealsNotificationsService.notifyPinMissingFinalized(
        locked.dealId,
        true,
      );
    }
  }

  private async markViolationIfNeeded(
    publicationId: string,
    errorCode: string,
    now: Date,
  ): Promise<void> {
    const publication = await this.publicationRepository.findOne({
      where: { id: publicationId },
    });

    if (!publication || publication.error === errorCode) {
      return;
    }

    await this.publicationRepository.update(publication.id, {
      status: PublicationStatus.DELETED_OR_EDITED,
      error: errorCode,
      lastCheckedAt: now,
      lastVerifiedAt: now,
    });
  }

  private getMessageHash(message: MtprotoChannelMessage): string {
    return buildMessageFingerprintHash({
      text: normalizeFingerprintText(message.text),
      mediaUniqueId: message.mediaUniqueId ?? 'none',
      entitiesSignature: message.entitiesSignature ?? 'none',
    });
  }

  private async selectCandidates(): Promise<DealPublicationEntity[]> {
    return this.publicationRepository
      .createQueryBuilder('publication')
      .innerJoinAndSelect('publication.deal', 'deal')
      .innerJoinAndSelect('deal.channel', 'channel')
      .leftJoin(ListingEntity, 'listing', 'listing.id = deal.listingId')
      .where('deal.stage = :stage', { stage: DealStage.POSTED_VERIFYING })
      .andWhere('deal.status = :status', { status: DealStatus.ACTIVE })
      .andWhere('publication.status = :publicationStatus', {
        publicationStatus: PublicationStatus.POSTED,
      })
      .andWhere('publication.publishedMessageId IS NOT NULL')
      .orderBy('publication.lastVerifiedAt', 'ASC', 'NULLS FIRST')
      .limit(30)
      .getMany();
  }

  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    task: (item: T) => Promise<void>,
  ): Promise<void> {
    let index = 0;
    const workers = Array.from(
      { length: Math.max(1, concurrency) },
      async () => {
        while (index < items.length) {
          const current = items[index++];
          await task(current);
        }
      },
    );

    await Promise.all(workers);
  }

  private async tryAdvisoryLock(key: string): Promise<boolean> {
    const result = await this.dataSource.query(
      'SELECT pg_try_advisory_lock(hashtext($1)) as locked',
      [key],
    );

    return Boolean(result?.[0]?.locked);
  }

  private async releaseAdvisoryLock(key: string): Promise<void> {
    await this.dataSource.query('SELECT pg_advisory_unlock(hashtext($1))', [
      key,
    ]);
  }
}
