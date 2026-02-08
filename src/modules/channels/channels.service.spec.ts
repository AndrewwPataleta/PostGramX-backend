jest.mock('../telegram/telegram-messenger.service', () => ({
    TelegramMessengerService: jest.fn(),
}));

import {ChannelsService} from './channels.service';
import {ChannelRole} from './types/channel-role.enum';
import {ChannelStatus} from './types/channel-status.enum';

class MockChannelQueryBuilder {
    async getManyAndCount() {
        return [
            [
                {
                    id: 'channel-1',
                    username: 'paused-channel',
                    title: 'Paused Channel',
                    status: ChannelStatus.VERIFIED,
                    telegramChatId: null,
                    subscribersCount: 1000,
                    avgViews: 100,
                    isDisabled: false,
                    isPaused: true,
                    pausedAt: new Date('2024-01-01T00:00:00Z'),
                    verifiedAt: new Date('2024-01-01T00:00:00Z'),
                    lastCheckedAt: null,
                    updatedAt: new Date('2024-01-02T00:00:00Z'),
                    membership: {
                        role: ChannelRole.OWNER,
                        telegramAdminStatus: null,
                        lastRecheckAt: null,
                    },
                },
            ],
            1,
        ];
    }

    innerJoinAndMapOne() {
        return this;
    }

    select() {
        return this;
    }

    addSelect() {
        return this;
    }

    andWhere() {
        return this;
    }

    orderBy() {
        return this;
    }

    addOrderBy() {
        return this;
    }

    skip() {
        return this;
    }

    take() {
        return this;
    }
}

describe('ChannelsService', () => {
    it('keeps paused channels visible in My Channels list', async () => {
        const channelRepository = {
            createQueryBuilder: jest.fn().mockReturnValue(new MockChannelQueryBuilder()),
        };
        const service = new ChannelsService(
            channelRepository as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
        );

        const result = await service.listForUser('user-1', {page: 1, limit: 20});

        expect(result.items).toHaveLength(1);
        expect(result.items[0].isPaused).toBe(true);
    });

    it('notifies owner when moderator pauses a channel', async () => {
        const channelRepository = {
            findOne: jest.fn().mockResolvedValue({
                id: 'channel-1',
                username: 'paused-channel',
                title: 'Paused Channel',
                ownerUserId: 'owner-1',
                createdByUserId: 'owner-1',
                isPaused: false,
                pausedAt: null,
                pausedByUserId: null,
            }),
            save: jest.fn().mockImplementation(async (entity) => entity),
        };
        const userRepository = {
            findOne: jest.fn().mockImplementation(async ({where}) => {
                if (where.id === 'owner-1') {
                    return {id: 'owner-1', telegramId: '111', firstName: 'Owner'};
                }
                if (where.id === 'moderator-1') {
                    return {id: 'moderator-1', username: 'moduser'};
                }
                return null;
            }),
        };
        const telegramMessengerService = {
            sendText: jest.fn().mockResolvedValue(undefined),
        };
        const channelModeratorsService = {
            requireCanReviewDeals: jest.fn().mockResolvedValue(undefined),
        };

        const service = new ChannelsService(
            channelRepository as any,
            {} as any,
            {} as any,
            {} as any,
            userRepository as any,
            {} as any,
            {} as any,
            {} as any,
            telegramMessengerService as any,
            channelModeratorsService as any,
        );

        await service.updatePausedStatus(
            'moderator-1',
            'channel-1',
            true,
            '123',
        );

        expect(telegramMessengerService.sendText).toHaveBeenCalledWith(
            '111',
            'telegram.channels.paused_by_moderator.body',
            {
                channel: '@paused-channel',
                moderator: 'moduser',
            },
        );
    });
});
