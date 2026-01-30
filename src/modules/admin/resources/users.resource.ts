import { User } from '../../auth/entities/user.entity';
import { ResourceOptions } from '../types/admin.types';
import { buildListActionWithSearch } from './resource-utils';

const options: ResourceOptions = {
  navigation: { name: 'PostgramX', icon: 'User' },
  listProperties: [
    'id',
    'telegramId',
    'username',
    'firstName',
    'lastName',
    'isPremium',
    'lang',
    'createdAt',
  ],
  showProperties: [
    'id',
    'telegramId',
    'username',
    'firstName',
    'lastName',
    'email',
    'lang',
    'isPremium',
    'isActive',
    'platformType',
    'authType',
    'avatar',
    'lastLoginAt',
    'createdAt',
  ],
  editProperties: ['username', 'firstName', 'lastName', 'lang', 'isPremium'],
  filterProperties: [
    'telegramId',
    'username',
    'firstName',
    'lastName',
    'isPremium',
    'lang',
    'createdAt',
  ],
  properties: {
    id: { isDisabled: true },
    telegramId: { isDisabled: true },
    createdAt: { isDisabled: true },
    username: { isTitle: true },
    lastLoginAt: { isVisible: { list: false, edit: false, filter: false } },
    email: { isVisible: { list: false, edit: false, filter: false } },
    avatar: { isVisible: { list: false, edit: false, filter: false } },
  },
  actions: {
    list: buildListActionWithSearch([
      'telegramId',
      'username',
      'firstName',
      'lastName',
    ]),
    delete: {
      guard:
        'This will permanently delete the user and related records. This action cannot be undone.',
    },
    bulkDelete: {
      guard:
        'This will permanently delete the selected users. This action cannot be undone.',
    },
  },
  sort: {
    sortBy: 'createdAt',
    direction: 'desc',
  },
};

export const usersResource = {
  resource: User,
  options,
};
