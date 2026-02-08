import {MarketplaceService} from './marketplace.service';
import {ChannelStatus} from '../channels/types/channel-status.enum';

class MockQueryBuilder {
    conditions: string[] = [];
    rawMany: any[] = [];
    rawOne: any = {total: '0'};

    innerJoin() {
        return this;
    }

    where(condition: string, _params?: Record<string, any>) {
        this.conditions.push(condition);
        return this;
    }

    andWhere(condition: string, _params?: Record<string, any>) {
        this.conditions.push(condition);
        return this;
    }

    select() {
        return this;
    }

    addSelect() {
        return this;
    }

    groupBy() {
        return this;
    }

    orderBy() {
        return this;
    }

    addOrderBy() {
        return this;
    }

    offset() {
        return this;
    }

    limit() {
        return this;
    }

    clone() {
        return this;
    }

    async getRawOne() {
        return this.rawOne;
    }

    async getRawMany() {
        return this.rawMany;
    }
}

describe('MarketplaceService', () => {
    it('filters out paused channels without requiring ownership', async () => {
        const queryBuilder = new MockQueryBuilder();
        const channelRepository = {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        };

        const service = new MarketplaceService(channelRepository as any);

        await service.listChannels({page: 1, limit: 10}, 'user-1');

        expect(
            queryBuilder.conditions.some((condition) =>
                condition.includes('channel.isPaused'),
            ),
        ).toBe(true);
        expect(
            queryBuilder.conditions.some((condition) =>
                condition.includes('ownerUserId'),
            ),
        ).toBe(false);
    });

    it('returns verified marketplace items for regular users', async () => {
        const queryBuilder = new MockQueryBuilder();
        queryBuilder.rawOne = {total: '1'};
        queryBuilder.rawMany = [
            {
                id: 'channel-1',
                name: 'Test Channel',
                username: 'test',
                status: ChannelStatus.VERIFIED,
                subscribers: '100',
                updatedAt: new Date().toISOString(),
                placementsCount: '2',
                minPriceNano: '1000',
                listingTags: JSON.stringify([['Crypto']]),
            },
        ];
        const channelRepository = {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        };

        const service = new MarketplaceService(channelRepository as any);

        const result = await service.listChannels({page: 1, limit: 10}, 'user-2');

        expect(result.items).toHaveLength(1);
        expect(result.items[0].verified).toBe(true);
    });
});
