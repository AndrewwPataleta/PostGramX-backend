import {DealsService} from './deals.service';
import {DealEntity} from './entities/deal.entity';
import {DealStatus} from '../../common/constants/deals/deal-status.constants';
import {DealEscrowStatus} from '../../common/constants/deals/deal-escrow-status.constants';
import {ListingEntity} from '../listings/entities/listing.entity';
import {ListingFormat} from '../../common/constants/channels/listing-format.constants';
import {CurrencyCode} from '../../common/constants/currency/currency.constants';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {Repository, DataSource} from 'typeorm';
import {DealCreativeEntity} from './entities/deal-creative.entity';
import {ChannelMembershipEntity} from '../channels/entities/channel-membership.entity';
import {User} from '../auth/entities/user.entity';
import {TransactionEntity} from '../payments/entities/transaction.entity';
import {DealsNotificationsService} from './deals-notifications.service';
import {PaymentsService} from '../payments/payments.service';
import {DealErrorCode} from '../../common/constants/errors/error-codes.constants';

describe('DealsService.getDealDetail', () => {
    let service: DealsService;
    let dealRepository: Repository<DealEntity>;
    let channelRepository: Repository<ChannelEntity>;
    let membershipRepository: Repository<ChannelMembershipEntity>;

    const listing = {
        id: 'listing-id',
        channelId: 'channel-id',
        format: ListingFormat.POST,
        priceNano: '100',
        currency: CurrencyCode.TON,
        tags: [],
        pinDurationHours: null,
        visibilityDurationHours: null,
        allowEdits: false,
        allowLinkTracking: false,
        allowPinnedPlacement: false,
        requiresApproval: false,
        contentRulesText: '',
        version: 1,
    } as ListingEntity;

    const channel = {
        id: 'channel-id',
        title: 'Test Channel',
        username: 'test_channel',
        subscribersCount: 1200,
    } as ChannelEntity;

    const baseDeal = {
        id: 'deal-id',
        advertiserUserId: 'advertiser-id',
        publisherOwnerUserId: 'publisher-id',
        createdByUserId: 'advertiser-id',
        listingId: 'listing-id',
        channelId: 'channel-id',
        listing,
        channel,
        status: DealStatus.PENDING,
        escrowStatus: DealEscrowStatus.SCHEDULING_PENDING,
        escrowWalletId: null,
        escrowAmountNano: null,
        escrowCurrency: CurrencyCode.TON,
        escrowPaymentAddress: null,
        escrowExpiresAt: null,
        paymentDeadlineAt: null,
        stalledAt: null,
        lastActivityAt: new Date(),
        idleExpiresAt: null,
        creativeDeadlineAt: null,
        adminReviewDeadlineAt: null,
        adminReviewNotifiedAt: null,
        creativeMessageId: null,
        creativePayload: null,
        creativeText: null,
        creativeSubmittedAt: null,
        adminReviewComment: null,
        approvedAt: null,
        listingSnapshot: null,
        scheduledAt: null,
        publishedMessageId: null,
        publishedAt: null,
        deliveryVerifiedAt: null,
        mustRemainUntil: null,
        deliveryError: null,
        cancelReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sideInitiator: null,
    } as unknown as DealEntity;

    beforeEach(() => {
        dealRepository = {
            findOne: jest.fn(),
        } as unknown as Repository<DealEntity>;
        channelRepository = {
            findOne: jest.fn(),
        } as unknown as Repository<ChannelEntity>;
        membershipRepository = {
            findOne: jest.fn(),
            count: jest.fn(),
        } as unknown as Repository<ChannelMembershipEntity>;

        service = new DealsService(
            {} as DataSource,
            dealRepository,
            {} as Repository<DealCreativeEntity>,
            {} as Repository<ListingEntity>,
            channelRepository,
            membershipRepository,
            {} as Repository<User>,
            {} as Repository<TransactionEntity>,
            {} as DealsNotificationsService,
            {} as PaymentsService,
        );
    });

    it('throws when deal is not found', async () => {
        jest.spyOn(dealRepository, 'findOne').mockResolvedValueOnce(null);

        await expect(
            service.getDealDetail('user-id', 'deal-id'),
        ).rejects.toMatchObject({
            code: DealErrorCode.DEAL_NOT_FOUND,
        });
    });

    it('throws when user is not a participant', async () => {
        jest.spyOn(dealRepository, 'findOne').mockResolvedValueOnce(baseDeal);
        jest.spyOn(membershipRepository, 'count').mockResolvedValueOnce(0);

        await expect(
            service.getDealDetail('other-user', 'deal-id'),
        ).rejects.toMatchObject({
            code: DealErrorCode.UNAUTHORIZED_DEAL_ACCESS,
        });
    });

    it('returns deal detail for advertiser', async () => {
        jest.spyOn(dealRepository, 'findOne').mockResolvedValueOnce(baseDeal);
        jest.spyOn(membershipRepository, 'count').mockResolvedValueOnce(0);

        const result = await service.getDealDetail(
            baseDeal.advertiserUserId,
            baseDeal.id,
        );

        expect(result.id).toBe(baseDeal.id);
        expect(result.userRoleInDeal).toBe('advertiser');
        expect(result.listing.snapshot?.listingId).toBe(listing.id);
    });

    it('returns deal detail for publisher owner', async () => {
        jest.spyOn(dealRepository, 'findOne').mockResolvedValueOnce(baseDeal);
        jest.spyOn(membershipRepository, 'count').mockResolvedValueOnce(0);

        const result = await service.getDealDetail(
            baseDeal.publisherOwnerUserId as string,
            baseDeal.id,
        );

        expect(result.userRoleInDeal).toBe('publisher');
        expect(result.channel?.id).toBe(channel.id);
    });

    it('returns deal detail for publisher manager', async () => {
        jest.spyOn(dealRepository, 'findOne').mockResolvedValueOnce(baseDeal);
        jest.spyOn(membershipRepository, 'count').mockResolvedValueOnce(1);

        const result = await service.getDealDetail(
            'manager-id',
            baseDeal.id,
        );

        expect(result.userRoleInDeal).toBe('publisher_manager');
    });
});
