import { ChannelEntity } from '../../channels/entities/channel.entity';
import { ResourceOptions } from '../types/admin.types';
import { buildListActionWithSearch } from './resource-utils';

const options: ResourceOptions = {
  navigation: { name: 'PostgramX', icon: 'Video' },
  listProperties: [
    'id',
    'username',
    'title',
    'createdByUserId',
    'subscribersCount',
    'status',
    'isDisabled',
    'createdAt',
  ],
  showProperties: [
    'id',
    'username',
    'title',
    'telegramChatId',
    'createdByUserId',
    'status',
    'isDisabled',
    'subscribersCount',
    'memberCount',
    'avgViews',
    'verifiedAt',
    'lastCheckedAt',
    'verificationErrorCode',
    'verificationErrorMessage',
    'languageStats',
    'createdAt',
    'updatedAt',
  ],
  editProperties: [
    'title',
    'status',
    'isDisabled',
    'subscribersCount',
    'memberCount',
    'avgViews',
    'verificationErrorCode',
    'verificationErrorMessage',
  ],
  filterProperties: [
    'username',
    'title',
    'telegramChatId',
    'createdByUserId',
    'status',
    'isDisabled',
    'subscribersCount',
    'createdAt',
  ],
  properties: {
    id: { isDisabled: true },
    telegramChatId: { isDisabled: true },
    createdByUserId: { isDisabled: true, reference: 'User' },
    username: { isTitle: true },
    languageStats: { isVisible: { list: false, edit: false, filter: false } },
  },
  actions: {
    list: buildListActionWithSearch(['username', 'title', 'telegramChatId']),
    delete: {
      guard:
        'This will permanently delete the channel and related records. This action cannot be undone.',
    },
    bulkDelete: {
      guard:
        'This will permanently delete the selected channels. This action cannot be undone.',
    },
  },
  sort: {
    sortBy: 'updatedAt',
    direction: 'desc',
  },
};

export const channelsResource = {
  resource: ChannelEntity,
  options,
};
