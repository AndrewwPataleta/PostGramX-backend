import {ChannelsService} from './channels.service';
import {ChannelEntity} from './entities/channel.entity';
import {ChannelMembershipEntity} from './entities/channel-membership.entity';
import {ChannelErrorCode} from './types/channel-error-code.enum';
import {ChannelRole} from './types/channel-role.enum';
import {
    TelegramChatErrorCode,
    TelegramChatServiceError,
} from '../telegram/telegram-chat.service';
import {ChannelStatus} from './types/channel-status.enum';

interface InMemoryRepository<T extends {id?: string}> {
    data: T[];
    create: jest.Mock<T, [Partial<T>]>;
    save: jest.Mock<Promise<T>, [T]>;
    findOne: jest.Mock<Promise<T | null>, [{where: Partial<T>}]>;
}

const createRepository = <T extends {id?: string}>(initial: T[] = []) => {
    const data: T[] = [...initial];

    return {
        data,
        create: jest.fn((entity: Partial<T>) => ({...(entity as T)})),
        save: jest.fn(async (entity: T) => {
            if (!entity.id) {
                entity.id = `id-${data.length + 1}`;
            }
            const index = data.findIndex((item) => item.id === entity.id);
            if (index >= 0) {
                data[index] = entity;
            } else {
                data.push(entity);
            }
            return entity;
        }),
        findOne: jest.fn(async ({where}: {where: Partial<T>}) => {
            const entries = Object.entries(where ?? {});
            if (entries.length === 0) {
                return null;
            }
            return (
                data.find((item) =>
                    entries.every(
                        ([key, value]) => (item as any)[key] === value,
                    ),
                ) ?? null
            );
        }),
    } as InMemoryRepository<T>;
};

describe('ChannelsService verifyChannel', () => {
    const userId = 'user-1';
    const telegramUserId = '42';
    const normalizedUsername = 'testchannel';
    const chat = {
        id: 123,
        type: 'channel',
        title: 'Test Channel',
        username: normalizedUsername,
        members_count: 250,
    };

    let channelRepository: InMemoryRepository<ChannelEntity> & {
        manager: {transaction: jest.Mock};
    };
    let membershipRepository: InMemoryRepository<ChannelMembershipEntity>;
    let telegramChatService: any;
    let telegramAdminsSyncService: any;

    const buildService = () =>
        new ChannelsService(
            channelRepository as any,
            membershipRepository as any,
            {find: jest.fn()} as any,
            {find: jest.fn()} as any,
            telegramChatService,
            telegramAdminsSyncService,
            {requireChannelRights: jest.fn()} as any,
        );

    beforeEach(() => {
        membershipRepository = createRepository<ChannelMembershipEntity>();
        channelRepository = Object.assign(createRepository<ChannelEntity>(), {
            manager: {
                transaction: jest.fn(async (fn: any) =>
                    fn({
                        getRepository: (entity: any) => {
                            if (entity === ChannelEntity) {
                                return channelRepository;
                            }
                            if (entity === ChannelMembershipEntity) {
                                return membershipRepository;
                            }
                            throw new Error('Unknown repository');
                        },
                    }),
                ),
            },
        });

        telegramChatService = {
            normalizeUsernameOrLink: jest
                .fn()
                .mockReturnValue(normalizedUsername),
            getChatByUsername: jest.fn().mockResolvedValue(chat),
            assertPublicChannel: jest.fn((chatValue: any) => chatValue),
            getChatAdministratorsByUsername: jest.fn().mockResolvedValue([]),
            extractBotAdmin: jest.fn(),
        };

        telegramAdminsSyncService = {
            syncChannelAdmins: jest.fn().mockResolvedValue(undefined),
        };
    });

    it('does not write data when bot is forbidden', async () => {
        telegramChatService.getChatByUsername.mockRejectedValue(
            new TelegramChatServiceError(TelegramChatErrorCode.BOT_FORBIDDEN),
        );

        const service = buildService();

        await expect(
            service.verifyChannel(normalizedUsername, userId, telegramUserId),
        ).rejects.toEqual(
            expect.objectContaining({code: ChannelErrorCode.BOT_FORBIDDEN}),
        );

        expect(channelRepository.manager.transaction).not.toHaveBeenCalled();
        expect(channelRepository.save).not.toHaveBeenCalled();
        expect(membershipRepository.save).not.toHaveBeenCalled();
    });

    it('does not write data when user is not admin', async () => {
        telegramChatService.getChatAdministratorsByUsername.mockResolvedValue([
            {status: 'administrator', user: {id: 999, is_bot: false}},
        ]);

        const service = buildService();

        await expect(
            service.verifyChannel(normalizedUsername, userId, telegramUserId),
        ).rejects.toEqual(
            expect.objectContaining({code: ChannelErrorCode.NOT_ADMIN}),
        );

        expect(channelRepository.manager.transaction).not.toHaveBeenCalled();
        expect(channelRepository.save).not.toHaveBeenCalled();
        expect(membershipRepository.save).not.toHaveBeenCalled();
    });

    it('creates channel and membership on successful verify', async () => {
        const userAdmin = {
            status: 'administrator',
            user: {id: Number(telegramUserId), is_bot: false},
            can_post_messages: true,
        };
        const botAdmin = {
            status: 'administrator',
            user: {id: 777, is_bot: true},
            can_post_messages: true,
        };
        telegramChatService.getChatAdministratorsByUsername.mockResolvedValue([
            userAdmin,
            botAdmin,
        ]);
        telegramChatService.extractBotAdmin.mockResolvedValue({
            bot: botAdmin.user,
            botAdmin,
        });

        const service = buildService();
        const result = await service.verifyChannel(
            normalizedUsername,
            userId,
            telegramUserId,
        );

        expect(result.status).toBe(ChannelStatus.VERIFIED);
        expect(channelRepository.save).toHaveBeenCalledTimes(1);
        expect(membershipRepository.save).toHaveBeenCalledTimes(1);
        expect(channelRepository.data).toHaveLength(1);
        expect(channelRepository.data[0]).toEqual(
            expect.objectContaining({
                username: normalizedUsername,
                title: chat.title,
                status: ChannelStatus.VERIFIED,
                createdByUserId: userId,
                ownerUserId: userId,
                telegramChatId: String(chat.id),
            }),
        );
        expect(membershipRepository.data[0]).toEqual(
            expect.objectContaining({
                channelId: channelRepository.data[0].id,
                userId,
                role: ChannelRole.OWNER,
            }),
        );
    });

    it('updates existing channel on success and leaves it unchanged on failure', async () => {
        const existingChannel: ChannelEntity = {
            id: 'channel-1',
            username: normalizedUsername,
            title: 'Old title',
            status: ChannelStatus.PENDING_VERIFY,
            createdByUserId: userId,
            ownerUserId: userId,
            telegramChatId: null,
            avatarUrl: null as any,
            verifiedAt: null,
            lastCheckedAt: null,
            subscribersCount: null,
            avgViews: null,
            isDisabled: false,
            languageStats: null,
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-01T00:00:00.000Z'),
            listings: [],
        };
        channelRepository.data.push(existingChannel);

        const userAdmin = {
            status: 'administrator',
            user: {id: Number(telegramUserId), is_bot: false},
            can_post_messages: true,
        };
        const botAdmin = {
            status: 'administrator',
            user: {id: 777, is_bot: true},
            can_post_messages: true,
        };
        telegramChatService.getChatAdministratorsByUsername.mockResolvedValue([
            userAdmin,
            botAdmin,
        ]);
        telegramChatService.extractBotAdmin.mockResolvedValue({
            bot: botAdmin.user,
            botAdmin,
        });

        const service = buildService();
        await service.verifyChannel(
            normalizedUsername,
            userId,
            telegramUserId,
        );

        expect(channelRepository.data[0]).toEqual(
            expect.objectContaining({
                title: chat.title,
                status: ChannelStatus.VERIFIED,
                telegramChatId: String(chat.id),
            }),
        );

        const snapshotBeforeFailure = {...channelRepository.data[0]};
        channelRepository.manager.transaction.mockClear();
        channelRepository.save.mockClear();
        membershipRepository.save.mockClear();

        telegramChatService.getChatAdministratorsByUsername.mockResolvedValue([
            {status: 'administrator', user: {id: 999, is_bot: false}},
        ]);

        await expect(
            service.verifyChannel(normalizedUsername, userId, telegramUserId),
        ).rejects.toEqual(
            expect.objectContaining({code: ChannelErrorCode.NOT_ADMIN}),
        );

        expect(channelRepository.manager.transaction).not.toHaveBeenCalled();
        expect(channelRepository.save).not.toHaveBeenCalled();
        expect(membershipRepository.save).not.toHaveBeenCalled();
        expect(channelRepository.data[0]).toEqual(snapshotBeforeFailure);
    });
});
