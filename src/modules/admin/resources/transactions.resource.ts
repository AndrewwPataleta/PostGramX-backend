import {TransactionEntity} from '../../payments/entities/transaction.entity';
import {ResourceOptions} from '../types/admin.types';
import {applyNanoToTon, applyNanoToTonForRecords} from './resource-utils';
import {CurrencyCode} from '../../../common/constants/currency/currency.constants';

const options: ResourceOptions = {
  navigation: { name: 'PostgramX', icon: 'Currency' },
  listProperties: [
    'id',
    'type',
    'status',
    'userId',
    'dealId',
    'amountTon',
    'currency',
    'depositAddress',
    'externalTxHash',
    'createdAt',
  ],
  showProperties: [
    'id',
    'type',
    'direction',
    'status',
    'userId',
    'dealId',
    'channelId',
    'counterpartyUserId',
    'amountTon',
    'amountNano',
    'currency',
    'depositAddress',
    'externalTxHash',
    'externalExplorerUrl',
    'description',
    'escrowWalletId',
    'errorCode',
    'errorMessage',
    'metadata',
    'confirmedAt',
    'completedAt',
    'createdAt',
    'updatedAt',
  ],
  editProperties: ['status', 'externalTxHash', 'description'],
  filterProperties: [
    'type',
    'status',
    'userId',
    'dealId',
    'externalTxHash',
    'depositAddress',
    'amountNano',
    'createdAt',
  ],
  properties: {
    id: { isDisabled: true },
    userId: { isDisabled: true, reference: 'User' },
    dealId: { isDisabled: true, reference: 'DealEntity' },
    channelId: { isDisabled: true, reference: 'ChannelEntity' },
    counterpartyUserId: { isDisabled: true, reference: 'User' },
    type: { isDisabled: true },
    direction: { isDisabled: true },
    amountNano: { isDisabled: true },
    currency: { isDisabled: true },
    depositAddress: { isDisabled: true },
    escrowWalletId: { isDisabled: true },
    metadata: { isVisible: { list: false, edit: false, filter: false } },
    amountTon: {
      isVisible: { list: true, show: true, edit: false, filter: false },
      label: `Amount (${CurrencyCode.TON})`,
      isSortable: false,
    },
  },
  actions: {
    list: {
      after: async (response: any) => {
        if (response?.records) {
          applyNanoToTonForRecords(
            response.records,
            'amountNano',
            'amountTon',
          );
        }
        return response;
      },
    },
    show: {
      after: async (response: any) => {
        if (response?.record) {
          applyNanoToTon(response.record, 'amountNano', 'amountTon');
        }
        return response;
      },
    },
    delete: { isAccessible: false, isVisible: false },
    bulkDelete: { isAccessible: false, isVisible: false },
  },
  sort: {
    sortBy: 'createdAt',
    direction: 'desc',
  },
};

export const transactionsResource = {
  resource: TransactionEntity,
  options,
};
